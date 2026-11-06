package com.example.hyenaapp.ui.components

import androidx.compose.material3.DatePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun EventCalendar(date: LocalDate, onDateChange: (String) -> Unit) {
    // Material stores a calendar date as midnight UTC regardless of device time zone.
    val dateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    val state = rememberDatePickerState(initialSelectedDateMillis = dateMillis)
    LaunchedEffect(state.selectedDateMillis, dateMillis) {
        val millis = state.selectedDateMillis ?: return@LaunchedEffect
        if (millis != dateMillis) {
            onDateChange(Instant.ofEpochMilli(millis).atOffset(ZoneOffset.UTC).toLocalDate().toString())
        }
    }
    DatePicker(state = state, showModeToggle = false)
}
