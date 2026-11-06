package com.example.hyenaapp.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import kotlin.coroutines.cancellation.CancellationException

@Composable
fun DiscoveryFiltersPanel(
    filters: DiscoveryFilters,
    onFiltersChange: (DiscoveryFilters) -> Unit,
    onClear: () -> Unit
) {
    var categories by remember { mutableStateOf<List<CategoryDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var failure by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableStateOf(0) }
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
            failure = if (error is HttpException) "Categories are temporarily unavailable. Please retry." else "Categories unavailable. Check your connection and retry."
        } finally {
            loading = false
        }
    }

    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Make it your kind of plan", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = filters.query,
            onValueChange = { onFiltersChange(filters.copy(query = it.take(100))) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Search experiences") },
            singleLine = true
        )
        Text("Categories", style = MaterialTheme.typography.titleSmall)
        Text("Choose any that interest you. Matches any selected category.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
            Text("No categories are available yet. Please try again later.")
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
            Text("Applied: up to ${filters.maxPrice} USD. Unknown prices are excluded.")
        } else if (filters.priceMode == "free") {
            Text("Only listings with a numeric price of zero. Unknown prices excluded.")
        }
        TextButton(onClick = onClear) { Text("Clear filters") }
    }
    }
}
