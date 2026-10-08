package com.example.hyenaapp.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ExperienceDetailsScreen(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Button(onClick = onBack) {
            Text(text = "Back")
        }

        Text(
            text = title,
            style = MaterialTheme.typography.headlineLarge
        )

        Text(
            text = businessName,
            style = MaterialTheme.typography.titleMedium
        )

        Text(
            text = "When",
            style = MaterialTheme.typography.titleSmall
        )

        Text(text = schedule)

        Text(
            text = "Offer",
            style = MaterialTheme.typography.titleSmall
        )

        Text(text = offer)
    }
}