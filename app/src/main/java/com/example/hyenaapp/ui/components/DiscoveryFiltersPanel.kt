package com.example.hyenaapp.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.data.remote.CategoryDto
import com.example.hyenaapp.data.repository.DiscoveryFilters
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.coroutines.cancellation.CancellationException

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoveryFiltersPanel(
    filters: DiscoveryFilters,
    timeZone: String,
    onFiltersChange: (DiscoveryFilters) -> Unit,
    onClear: () -> Unit
) {
    var categories by remember { mutableStateOf<List<CategoryDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var retry by remember { mutableStateOf(0) }
    var categoryOpen by remember { mutableStateOf(false) }
    var currencyOpen by remember { mutableStateOf(false) }
    var showDate by remember { mutableStateOf(false) }
    var draftPrice by remember(filters.maxPrice, filters.priceMode) { mutableStateOf(filters.maxPrice) }
    val validPrice = Regex("\\d{1,8}(?:\\.\\d{1,2})?").matches(draftPrice)
    val latestFilters by rememberUpdatedState(filters)
    val latestChange by rememberUpdatedState(onFiltersChange)

    LaunchedEffect(retry) {
        loading = true
        failed = false
        try {
            categories = ApiClient.api.getCategories().items
            if (latestFilters.categoryId != null && categories.none { it.id == latestFilters.categoryId }) {
                latestChange(latestFilters.copy(categoryId = null))
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            failed = true
        } finally {
            loading = false
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = filters.query,
            onValueChange = { onFiltersChange(filters.copy(query = it.take(100))) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Search experiences") },
            singleLine = true
        )
        Box {
            OutlinedButton(onClick = { categoryOpen = true }, enabled = !loading) {
                val name = categories.firstOrNull { it.id == filters.categoryId }?.name
                Text(if (loading) "Loading categories…" else "Category: ${name ?: if (filters.categoryId == null) "All categories" else "Selected category"}")
            }
            DropdownMenu(expanded = categoryOpen, onDismissRequest = { categoryOpen = false }) {
                DropdownMenuItem(text = { Text("All categories") }, onClick = {
                    onFiltersChange(filters.copy(categoryId = null))
                    categoryOpen = false
                })
                categories.forEach { category ->
                    DropdownMenuItem(text = { Text(category.name) }, onClick = {
                        onFiltersChange(filters.copy(categoryId = category.id))
                        categoryOpen = false
                    })
                }
            }
        }
        if (failed) {
            Text("Couldn't load categories.")
            TextButton(onClick = { retry++ }) { Text("Retry categories") }
        } else if (!loading && categories.isEmpty()) {
            Text("No categories available.")
        }
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("any" to "Any price", "free" to "Free", "max" to "Maximum price").forEach { (mode, label) ->
                FilterChip(selected = filters.priceMode == mode, onClick = {
                    onFiltersChange(filters.copy(priceMode = mode))
                }, label = { Text(label) })
            }
        }
        if (filters.priceMode == "max") {
            Box {
                OutlinedButton(onClick = { currencyOpen = true }) { Text("Currency: ${filters.currency}") }
                DropdownMenu(expanded = currencyOpen, onDismissRequest = { currencyOpen = false }) {
                    listOf("USD", "CAD", "EUR", "GBP").forEach { code ->
                        DropdownMenuItem(text = { Text(code) }, onClick = {
                            onFiltersChange(filters.copy(currency = code))
                            currencyOpen = false
                        })
                    }
                }
            }
            OutlinedTextField(
                value = draftPrice,
                onValueChange = { draftPrice = it.take(12) },
                label = { Text("Maximum price (${filters.currency})") },
                singleLine = true,
                isError = !validPrice,
                modifier = Modifier.fillMaxWidth()
            )
            if (!validPrice) Text("Enter 0–99999999.99 with at most two decimal places.")
            Button(enabled = validPrice, onClick = {
                onFiltersChange(filters.copy(maxPrice = draftPrice))
            }) { Text("Apply maximum") }
            Text("Applied: up to ${filters.maxPrice} ${filters.currency}. Unknown prices excluded; no currency conversion.")
        } else if (filters.priceMode == "free") {
            Text("Only listings with a numeric price of zero. Unknown prices excluded.")
        }
        DiscoveryWindowPicker(selectedWindow = filters.window, onWindowChange = {
            onFiltersChange(filters.copy(window = it, date = null))
        })
        OutlinedButton(onClick = { showDate = true }) {
            Text(if (filters.window == "date") "Date: ${filters.date}" else "Choose a date")
        }
        TextButton(onClick = onClear) { Text("Clear filters") }
    }
    if (showDate) {
        val initial = filters.date?.let(LocalDate::parse) ?: LocalDate.now(ZoneId.of(timeZone))
        // Material date-picker milliseconds represent the chosen calendar date in UTC.
        val state = rememberDatePickerState(initialSelectedDateMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(enabled = state.selectedDateMillis != null, onClick = {
                    state.selectedDateMillis?.let { millis ->
                        val date = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
                        onFiltersChange(filters.copy(window = "date", date = date))
                    }
                    showDate = false
                }) { Text("Apply date") }
            },
            dismissButton = { TextButton(onClick = { showDate = false }) { Text("Cancel") } }
        ) { DatePicker(state = state) }
    }
}
