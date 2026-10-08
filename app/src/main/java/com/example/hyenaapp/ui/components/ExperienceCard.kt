package com.example.hyenaapp.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable

@Composable
fun ExperienceCard(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    Card(modifier = modifier
        .fillMaxWidth()
        .clickable(onClick=onClick)) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = businessName,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = schedule,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = offer,
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}