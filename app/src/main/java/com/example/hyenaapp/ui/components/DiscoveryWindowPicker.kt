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
    onCalendarClick: () -> Unit,
    modifier: Modifier = Modifier,
    quickOnly: Boolean = false
) {
    val quickOptions = listOf("now" to "Now", "tonight" to "Tonight", "tomorrow" to "Tomorrow", "date" to "Calendar")
    val options = if (quickOnly) quickOptions else quickOptions + listOf("today" to "Today", "all" to "All dates")
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = selectedWindow == value,
                onClick = { if (value == "date") onCalendarClick() else onWindowChange(value) },
                label = { Text(label) }
            )
        }
    }
}
