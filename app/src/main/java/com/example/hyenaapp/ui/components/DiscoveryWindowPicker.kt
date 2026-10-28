package com.example.hyenaapp.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DiscoveryWindowPicker(
    selectedWindow: String,
    onWindowChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val options = listOf("today" to "Today", "tonight" to "Tonight", "now" to "Now", "all" to "All dates")
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = selectedWindow == value,
                onClick = { onWindowChange(value) },
                label = { Text(label) }
            )
        }
    }
}
