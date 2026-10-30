package com.example.hyenaapp.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.Locale

@Composable
fun ExperienceCard(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    distanceMiles: Double? = null,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
    isSaved: Boolean = false,
    savingEnabled: Boolean = true,
    onToggleSave: (() -> Unit)? = null
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(businessName, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                distanceMiles?.let {
                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) {
                        Text(if (it < 0.1) "<0.1 mi" else String.format(Locale.US, "%.1f mi", it), Modifier.padding(horizontal = 10.dp, vertical = 6.dp), style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            Text(title, style = MaterialTheme.typography.titleLarge)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("WHEN", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(schedule, style = MaterialTheme.typography.bodyMedium)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.small) {
                Text(offer, Modifier.fillMaxWidth().padding(12.dp), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
            onToggleSave?.let { toggle ->
                TextButton(onClick = toggle, enabled = savingEnabled, modifier = Modifier.align(Alignment.End)) {
                    Text(if (isSaved) "Saved · Remove" else "Save experience")
                }
            }
        }
    }
}
