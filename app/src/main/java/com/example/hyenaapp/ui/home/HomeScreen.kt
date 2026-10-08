package com.example.hyenaapp.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.sample.SampleExperiences
import com.example.hyenaapp.ui.components.ExperienceCard

@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    onExperienceClick: (String, String, String, String) -> Unit = { _, _, _, _ -> }
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Hyena",
            style = MaterialTheme.typography.headlineLarge
        )

        Text(
            text = "What can you do today?",
            style = MaterialTheme.typography.titleMedium
        )

        SampleExperiences.items.forEach { experience ->
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