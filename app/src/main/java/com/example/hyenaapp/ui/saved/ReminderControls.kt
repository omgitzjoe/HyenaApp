package com.example.hyenaapp.ui.saved

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.reminders.EventReminders

@Composable
internal fun ReminderControls(
    reminders: EventReminders,
    saved: List<Experience>,
    experience: Experience? = null,
    enabled: Boolean
) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val id = experience?.id
    var current by remember(id) {
        mutableStateOf(if (id == null) reminders.defaultMinutes() else reminders.overrideMinutes(id))
    }
    var allowed by remember { mutableStateOf(reminders.notificationsAllowed()) }
    var precise by remember { mutableStateOf(reminders.exactAllowed()) }
    var scheduled by remember(id) { mutableStateOf(id?.let(reminders::scheduledTime)) }
    var editing by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        allowed = reminders.notificationsAllowed()
        reminders.restore()
    }
    DisposableEffect(owner, reminders) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                allowed = reminders.notificationsAllowed()
                precise = reminders.exactAllowed()
                reminders.restore()
                scheduled = id?.let(reminders::scheduledTime)
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    fun update(minutes: Int?) {
        reminders.setLeadTime(id, minutes, saved)
        scheduled = id?.let(reminders::scheduledTime)
        current = minutes
        editing = false
        if (minutes != null && minutes > 0 && Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            permission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    val effectiveMinutes = current ?: reminders.defaultMinutes()
    val label = when {
        current == null -> "Use default (${leadLabel(effectiveMinutes)})"
        else -> leadLabel(effectiveMinutes)
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedButton(enabled = enabled, onClick = {
            draft = effectiveMinutes.takeIf { it > 0 }?.toString().orEmpty()
            editing = true
        }) {
            Text(if (id == null) "Default reminder · $label" else "Event reminder · $label")
        }
        if (id != null && effectiveMinutes > 0) {
            Text(
                scheduled?.let { "Scheduled for $it" } ?: "No reminder is currently scheduled for this event.",
                style = MaterialTheme.typography.bodySmall
            )
        }
        if (effectiveMinutes > 0 && !allowed) {
            TextButton(onClick = {
                context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }) { Text("Enable notifications in Android settings") }
        }
        if (effectiveMinutes > 0 && !precise && Build.VERSION.SDK_INT >= 31) {
            TextButton(onClick = {
                try {
                    context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:${context.packageName}")))
                } catch (_: ActivityNotFoundException) {
                    message = "Find Hyena under Alarms & reminders in Android settings."
                }
            }) { Text("Enable precise reminders") }
        }
        message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
    if (editing) {
        val minutes = draft.toIntOrNull()
        AlertDialog(
            onDismissRequest = { editing = false },
            title = { Text(if (id == null) "Default reminder for saved events" else "Custom event reminder") },
            text = {
                Column(
                    Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Send one reminder before the event starts. Choose a lead time that is still in the future.")
                    if (id != null) TextButton(onClick = { update(null) }) { Text("Use default") }
                    TextButton(onClick = { update(0) }) { Text("Off") }
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it.filter(Char::isDigit).take(5) },
                        label = { Text("Minutes before the event") },
                        supportingText = { Text("1 minute to 7 days (10,080 minutes)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                TextButton(enabled = minutes != null && minutes in 1..10080, onClick = {
                    minutes?.let { update(it) }
                }) { Text("Save reminder") }
            },
            dismissButton = { TextButton(onClick = { editing = false }) { Text("Cancel") } }
        )
    }
}

private fun leadLabel(minutes: Int): String = when {
    minutes == 0 -> "Off"
    minutes == 1 -> "1 minute before"
    minutes == 60 -> "1 hour before"
    minutes == 1440 -> "1 day before"
    minutes % 1440 == 0 -> "${minutes / 1440} days before"
    minutes % 60 == 0 -> "${minutes / 60} hours before"
    else -> "$minutes minutes before"
}
