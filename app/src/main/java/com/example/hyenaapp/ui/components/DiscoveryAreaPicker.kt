package com.example.hyenaapp.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.data.remote.AreaDto
import kotlin.coroutines.cancellation.CancellationException

@Composable
fun DiscoveryAreaPicker(selectedAreaId: String?, onAreaChange: (String?) -> Unit) {
    var areas by remember { mutableStateOf<List<AreaDto>>(emptyList()) }
    var expanded by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var retry by remember { mutableStateOf(0) }

    LaunchedEffect(retry) {
        loading = true
        failed = false
        try {
            areas = ApiClient.api.getAreas().items
            // A previously selected area may have been deactivated.
            if (selectedAreaId != null && areas.none { it.id == selectedAreaId }) {
                onAreaChange(null)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            failed = true
        } finally {
            loading = false
        }
    }

    val selected = areas.firstOrNull { it.id == selectedAreaId }
    Column {
        Box {
            OutlinedButton(onClick = { expanded = true }, enabled = !loading) {
                Text(if (loading) "Loading areas…" else "Area: ${selected?.name ?: if (selectedAreaId == null) "All areas" else "Selected area"}")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                DropdownMenuItem(text = { Text("All areas") }, onClick = {
                    onAreaChange(null)
                    expanded = false
                })
                areas.forEach { area ->
                    DropdownMenuItem(text = { Text("${area.name} · ${area.timeZone}") }, onClick = {
                        onAreaChange(area.id)
                        expanded = false
                    })
                }
            }
        }
        if (failed) {
            Text("Couldn't load areas. Check your connection.")
            TextButton(onClick = { retry++ }) { Text("Retry areas") }
        } else if (!loading && areas.isEmpty()) {
            Text("No active areas available.")
        }
    }
}
