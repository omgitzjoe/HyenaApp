package com.example.hyenaapp.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
            .padding(24.dp)
    ) {
        Text(
            text = "Hyena",
            style = MaterialTheme.typography.headlineLarge
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "What can you do today?",
            style = MaterialTheme.typography.titleMedium
        )

        Spacer(modifier = Modifier.height(24.dp))

        ExperienceCard(
            title = "Trivia Night",
            businessName = "Example Café",
            schedule = "Tonight · 7–9 PM",
            offer = "Free entry",
            onClick = {
                onExperienceClick(
                    "Trivia Night",
                    "Example Café",
                    "Tonight · 7–9 PM",
                    "Free entry"
                )
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        ExperienceCard(
            title = "Dinner Special",
            businessName = "Example Grill",
            schedule = "Tonight · 5–8 PM",
            offer = "$8 meal deal",
            onClick = {
                onExperienceClick(
                    "Dinner Special",
                    "Example Grill",
                    "Tonight · 5–8 PM",
                    "$8 meal deal"
                )
            }
        )
    }
}