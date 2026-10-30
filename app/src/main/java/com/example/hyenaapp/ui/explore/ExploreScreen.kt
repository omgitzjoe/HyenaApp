package com.example.hyenaapp.ui.explore

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.ExperienceRepository
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.ExperienceCard
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

@Composable
fun ExploreScreen(
    modifier: Modifier = Modifier,
    nearby: NearbyLocation? = null,
    radiusMiles: Int = 10,
    timeZone: String = java.time.ZoneId.systemDefault().id,
    locationControls: @Composable () -> Unit = {},
    filters: DiscoveryFilters = DiscoveryFilters(),
    filterControls: @Composable () -> Unit = {},
    savedIds: Set<String> = emptySet(),
    savingEnabled: Boolean = true,
    onToggleSave: (Experience) -> Unit = {},
    onExperienceClick: (Experience) -> Unit = {}
) {
    var experiences by remember {
        mutableStateOf<List<Experience>>(emptyList())
    }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    val query = filters.query.trim()

    LaunchedEffect(filters, nearby, radiusMiles, timeZone, reloadKey) {
        if (nearby == null) { experiences = emptyList(); isLoading = false; errorMessage = null; return@LaunchedEffect }
        isLoading = true
        errorMessage = null

        try {
            if (query.isNotEmpty()) {
                delay(300)
            }

            experiences = ExperienceRepository.getExperiences(query, filters.window, timeZone, nearby, radiusMiles, filters)
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

        item { filterControls() }

        item { locationControls() }


        when {
            nearby == null -> item { Text("Enable location to discover experiences around you.") }
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
                            "No experiences match these filters. Try Clear filters or All dates."
                        } else {
                            "No experiences match your search and filters. Try Clear filters."
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
                        schedule = experience.schedule, distanceMiles = experience.distanceMiles,
                        offer = experience.offer,
                        onClick = { onExperienceClick(experience) },
                        isSaved = experience.id in savedIds,
                        savingEnabled = savingEnabled,
                        onToggleSave = { onToggleSave(experience) }
                    )
                }
            }
        }
    }
}
