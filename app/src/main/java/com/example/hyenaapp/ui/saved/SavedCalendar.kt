package com.example.hyenaapp.ui.saved

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@Composable
internal fun SavedCalendar(
    date: LocalDate,
    month: YearMonth,
    eventCounts: Map<LocalDate, Int>,
    onMonthChange: (YearMonth) -> Unit,
    onSelect: (LocalDate) -> Unit
) {
    val first = month.atDay(1)
    val offset = first.dayOfWeek.value % 7
    val weeks = (offset + month.lengthOfMonth() + 6) / 7
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { onMonthChange(month.minusMonths(1)) }) { Text("Previous") }
                Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy")), Modifier.weight(1f))
                TextButton(onClick = { onMonthChange(month.plusMonths(1)) }) { Text("Next") }
            }
            Row(Modifier.fillMaxWidth()) {
                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach { label ->
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        Text(label, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            repeat(weeks) { week ->
                Row(Modifier.fillMaxWidth()) {
                    repeat(7) { column ->
                        val day = week * 7 + column - offset + 1
                        if (day !in 1..month.lengthOfMonth()) {
                            Spacer(Modifier.weight(1f))
                        } else {
                            val cell = month.atDay(day)
                            val count = eventCounts[cell] ?: 0
                            val selected = cell == date
                            Surface(
                                modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                    .selectable(selected, role = Role.Button, onClick = { onSelect(cell) })
                                    .semantics {
                                        contentDescription = "$cell, $count saved events"
                                    },
                                shape = MaterialTheme.shapes.small,
                                color = when {
                                    selected -> MaterialTheme.colorScheme.primaryContainer
                                    count > 0 -> MaterialTheme.colorScheme.secondaryContainer
                                    else -> MaterialTheme.colorScheme.surface
                                }
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.padding(vertical = 4.dp)) {
                                    Text(day.toString(), style = MaterialTheme.typography.bodyMedium)
                                    if (count > 0) Text(count.toString(), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
