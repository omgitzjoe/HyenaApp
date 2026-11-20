package com.example.hyenaapp.ui.saved

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.hyenaapp.data.repository.DeviceCalendar
import com.example.hyenaapp.data.repository.deviceCalendars
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun CalendarImport(enabled: Boolean, status: String?, onImport: (List<DeviceCalendar>) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var calendars by remember { mutableStateOf<List<DeviceCalendar>>(emptyList()) }
    var selected by remember { mutableStateOf<DeviceCalendar?>(null) }
    var showingPicker by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun openPicker() {
        loading = true
        error = null
        scope.launch {
            try {
                calendars = deviceCalendars(context)
                selected = calendars.singleOrNull { it.primary } ?: calendars.singleOrNull()
                showingPicker = calendars.isNotEmpty()
                if (!showingPicker) error = "No visible calendars found. Check that your phone calendar is synced and visible."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                error = "Couldn't read your phone calendars. Check calendar access and try again."
            } finally {
                loading = false
            }
        }
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) openPicker()
        else error = "Allow calendar access in Android settings to import events."
    }
    TextButton(enabled = enabled && !loading, onClick = {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED) {
            openPicker()
        } else {
            permission.launch(Manifest.permission.READ_CALENDAR)
        }
    }) { Text(if (loading) "Reading phone calendars…" else "Import from phone calendar") }
    (error ?: status)?.let { Text(it) }

    if (showingPicker) {
        AlertDialog(
            onDismissRequest = { showingPicker = false },
            title = { Text("Choose a calendar") },
            text = {
                Column {
                    Text("Copy events from the next 90 days into Saved on this phone.")
                    Column(Modifier.heightIn(max = 240.dp).verticalScroll(rememberScrollState()).selectableGroup()) {
                        calendars.forEach { calendar ->
                            Row(
                                Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(
                                    selected = selected == calendar,
                                    onClick = { selected = calendar },
                                    role = Role.RadioButton
                                ),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(selected = selected == calendar, onClick = null)
                                Column {
                                    Text(calendar.name)
                                    if (calendar.account.isNotBlank()) Text(calendar.account)
                                }
                            }
                        }
                    }
                    if (calendars.size > 1) {
                        TextButton(enabled = enabled, onClick = {
                            showingPicker = false
                            onImport(calendars)
                        }) { Text("Import all calendars") }
                    }
                }
            },
            confirmButton = {
                TextButton(enabled = selected != null && enabled, onClick = {
                    selected?.let { onImport(listOf(it)) }
                    showingPicker = false
                }) { Text("Import events") }
            },
            dismissButton = { TextButton(onClick = { showingPicker = false }) { Text("Cancel") } }
        )
    }
}
