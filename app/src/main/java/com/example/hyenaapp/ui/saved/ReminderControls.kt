package com.example.hyenaapp.ui.saved

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.reminders.EventReminders
import java.time.Instant

@Composable
internal fun ReminderControls(experience: Experience, enabled: Boolean) {
    val context = LocalContext.current
    val reminders = remember(context) { EventReminders(context) }
    var minutes by remember(experience.id) { mutableStateOf(reminders.minutes(experience.id)) }
    var expanded by remember { mutableStateOf(false) }
    var pendingMinutes by remember { mutableStateOf<Int?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var allowed by remember { mutableStateOf(reminders.notificationsAllowed()) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner, experience.id) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                allowed = reminders.notificationsAllowed()
                minutes = reminders.minutes(experience.id)
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    fun setReminder(value: Int) {
        if (reminders.schedule(experience, value)) { minutes = value; message = "Reminder saved on this phone." }
        else message = "Choose a shorter lead time so the reminder is still in the future, and check notifications are enabled."
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        allowed = reminders.notificationsAllowed()
        val selected = pendingMinutes
        if (granted && allowed && selected != null) setReminder(selected)
        else message = "Notifications are disabled. Enable them in Android settings, then choose a reminder."
        pendingMinutes = null
    }
    val future = runCatching { Instant.parse(experience.occurrenceStart).isAfter(Instant.now()) }.getOrDefault(false)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box {
            OutlinedButton(enabled = enabled && future, onClick = { expanded = true }) {
                Text(minutes?.let { "Reminder: ${leadLabel(it)} before" } ?: "Set event reminder")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                listOf(15, 30, 60, 120, 1440).forEach { value ->
                    DropdownMenuItem(text = { Text("${leadLabel(value)} before") }, onClick = {
                        expanded = false
                        if (Build.VERSION.SDK_INT >= 33 && androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            pendingMinutes = value; permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else if (!reminders.notificationsAllowed()) {
                            allowed = false; message = "Enable notifications in Android settings, then choose a reminder."
                        } else setReminder(value)
                    })
                }
            }
        }
        if (minutes != null) TextButton(enabled = enabled, onClick = { reminders.cancel(experience.id); minutes = null; message = "Reminder removed." }) { Text("Remove reminder") }
        if (!future) Text("Reminders need a saved event with an upcoming start time.", style = MaterialTheme.typography.bodySmall)
        if (!allowed) TextButton(onClick = {
            context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
        }) { Text("Notification settings") }
        message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
}

private fun leadLabel(minutes: Int): String = when (minutes) {
    60 -> "1 hour"
    120 -> "2 hours"
    1440 -> "1 day"
    else -> "$minutes minutes"
}
