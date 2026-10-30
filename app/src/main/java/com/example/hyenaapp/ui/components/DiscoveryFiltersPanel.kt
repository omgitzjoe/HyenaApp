package com.example.hyenaapp.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import retrofit2.HttpException
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
    var failure by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableStateOf(0) }
    var showDate by remember { mutableStateOf(false) }
    var draftPrice by remember(filters.maxPrice, filters.priceMode) { mutableStateOf(filters.maxPrice) }
    val validPrice = Regex("\\d{1,8}(?:\\.\\d{1,2})?").matches(draftPrice)
    val latestFilters by rememberUpdatedState(filters)
    val latestChange by rememberUpdatedState(onFiltersChange)

    LaunchedEffect(retry) {
        loading = true
        failure = null
        try {
            categories = ApiClient.api.getCategories().items
            val valid = latestFilters.categoryIds.filter { id -> categories.any { it.id == id } }
            if (valid != latestFilters.categoryIds) latestChange(latestFilters.copy(categoryIds = valid))
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            failure = if (error is HttpException) "Categories unavailable (HTTP ${error.code()}). Check or restart the API." else "Categories unavailable. Check your connection and retry."
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
        Text("Categories")
        if (loading) Text("Loading categories…")
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(selected = filters.categoryIds.isEmpty(), onClick = { onFiltersChange(filters.copy(categoryIds = emptyList())) }, label = { Text("All categories") })
            categories.forEach { category ->
                FilterChip(selected = category.id in filters.categoryIds, onClick = { onFiltersChange(filters.copy(categoryIds = if (category.id in filters.categoryIds) filters.categoryIds - category.id else filters.categoryIds + category.id)) }, label = { Text(category.name) })
            }
        }
        if (failure != null) {
            Text(failure.orEmpty())
            TextButton(onClick = { retry++ }) { Text("Retry categories") }
        } else if (!loading && categories.isEmpty()) {
            Text("The API returned no categories. Check the category data in the database.")
            TextButton(onClick = { retry++ }) { Text("Reload categories") }
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
            OutlinedTextField(
                value = draftPrice,
                onValueChange = { draftPrice = it.take(12) },
                label = { Text("Maximum price (USD)") },
                singleLine = true,
                isError = !validPrice,
                modifier = Modifier.fillMaxWidth()
            )
            if (!validPrice) Text("Enter 0–99999999.99 with at most two decimal places.")
            Button(enabled = validPrice, onClick = {
                onFiltersChange(filters.copy(maxPrice = draftPrice))
            }) { Text("Apply maximum") }
            Text("Applied: up to ${filters.maxPrice} USD. Unknown prices excluded; no currency conversion.")
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
