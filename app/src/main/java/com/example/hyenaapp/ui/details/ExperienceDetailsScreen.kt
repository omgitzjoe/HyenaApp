package com.example.hyenaapp.ui.details

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.ui.components.PageHeader

@Composable
fun ExperienceDetailsScreen(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    isSaved: Boolean = false,
    savingEnabled: Boolean = true,
    onToggleSave: () -> Unit = {}
) {
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        TextButton(onClick = onBack) { Text("Back to experiences") }
        PageHeader("Experience / Details", title, businessName)
        DetailSection("When", schedule)
        DetailSection("Price & offer", offer)
        Button(onClick = onToggleSave, enabled = savingEnabled, modifier = Modifier.fillMaxWidth()) {
            Text(if (isSaved) "Remove from saved" else "Save this experience")
        }
        Text("Times are shown in your local time. Confirm availability with the venue before visiting.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DetailSection(label: String, value: String) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(label, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            Text(value, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
