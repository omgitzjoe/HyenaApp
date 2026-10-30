package com.example.hyenaapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.luminance
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.R

@Composable
fun PageHeader(eyebrow: String, title: String, subtitle: String, mascot: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    val gradient = Brush.linearGradient(listOf(colors.primaryContainer,
        if (colors.background.luminance() > 0.5f) colors.secondaryContainer else colors.primaryContainer))
    Surface(color = colors.primaryContainer, shape = MaterialTheme.shapes.large) {
        Row(Modifier.fillMaxWidth().background(gradient).padding(20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(eyebrow.uppercase(java.util.Locale.US), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(title, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            if (mascot) Image(painterResource(R.drawable.hyena_mascot_realistic), contentDescription = null, modifier = Modifier.size(72.dp))
        }
    }
}

@Composable
fun FormSection(title: String, description: String) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 12.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
