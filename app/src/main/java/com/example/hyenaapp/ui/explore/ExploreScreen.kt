package com.example.hyenaapp.ui.explore

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.sample.SampleExperiences
import com.example.hyenaapp.ui.components.ExperienceCard

@Composable
fun ExploreScreen(
    modifier: Modifier = Modifier,
    onExperienceClick: (String, String, String, String) -> Unit = { _, _, _, _ -> }
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    val query = searchQuery.trim()

    val filteredExperiences = SampleExperiences.items.filter { experience ->
        query.isBlank() ||
                experience.title.contains(query, ignoreCase = true) ||
                experience.businessName.contains(query, ignoreCase = true) ||
                experience.offer.contains(query, ignoreCase = true)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Explore",
            style = MaterialTheme.typography.headlineLarge
        )

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Search experiences") },
            singleLine = true
        )

        filteredExperiences.forEach { experience ->
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

        if (filteredExperiences.isEmpty()) {
            Text(text = "No experiences match your search.")
        }
    }
}