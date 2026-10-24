package com.example.hyenaapp.ui.explore

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.ExperienceRepository
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.ExperienceCard
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

@Composable
fun ExploreScreen(
    modifier: Modifier = Modifier,
    onExperienceClick: (String, String, String, String) -> Unit = { _, _, _, _ -> }
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var experiences by remember {
        mutableStateOf<List<Experience>>(emptyList())
    }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    val query = searchQuery.trim()

    LaunchedEffect(query, reloadKey) {
        isLoading = true
        errorMessage = null

        try {
            if (query.isNotEmpty()) {
                delay(300)
            }

            experiences = ExperienceRepository.getExperiences(query)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            errorMessage =
                "Couldn't load experiences. Check your connection and server."
        } finally {
            isLoading = false
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Explore",
                style = MaterialTheme.typography.headlineLarge
            )
        }

        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it.take(100) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search experiences") },
                singleLine = true
            )
        }

        when {
            isLoading -> {
                item {
                    CircularProgressIndicator()
                }
            }

            errorMessage != null -> {
                item {
                    Text(text = errorMessage.orEmpty())
                }

                item {
                    Button(onClick = { reloadKey++ }) {
                        Text(text = "Retry")
                    }
                }
            }

            experiences.isEmpty() -> {
                item {
                    Text(
                        text = if (query.isEmpty()) {
                            "No experiences available."
                        } else {
                            "No experiences match your search."
                        }
                    )
                }
            }

            else -> {
                items(
                    items = experiences,
                    key = { experience -> experience.id }
                ) { experience ->
                    ExperienceCard(
                        title = experience.title,
                        businessName = experience.businessName,
                        schedule = experience.schedule,
                        offer = experience.offer,
                        onClick = {
                            onExperienceClick(
                                experience.title,
                                experience.businessName,
                                experience.schedule,
                                experience.offer
                            )
                        }
                    )
                }
            }
        }
    }
}