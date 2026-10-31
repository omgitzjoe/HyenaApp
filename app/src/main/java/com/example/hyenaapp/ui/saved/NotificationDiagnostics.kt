package com.example.hyenaapp.ui.saved

import android.Manifest
import android.content.Intent
import android.net.Uri
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
import com.example.hyenaapp.reminders.EventReminders

@Composable
internal fun NotificationDiagnostics() {
    val context = LocalContext.current
    val reminders = remember(context) { EventReminders(context) }
    var precise by remember { mutableStateOf(reminders.exactAllowed()) }
    var allowed by remember { mutableStateOf(reminders.notificationsAllowed()) }
    var diagnostic by remember { mutableStateOf(reminders.diagnostic()) }
    var message by remember { mutableStateOf<String?>(null) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) {
            reminders.restore(); precise = reminders.exactAllowed(); allowed = reminders.notificationsAllowed(); diagnostic = reminders.diagnostic()
        } }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        allowed = reminders.notificationsAllowed()
        message = if (allowed) "Notifications enabled. Try a test below." else "Enable notifications in Android settings."
    }
    Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Reminder delivery", style = MaterialTheme.typography.titleMedium)
            Text("Notifications: ${if (allowed) "enabled" else "disabled"} · Timing: ${if (precise) "precise" else "approximate"}")
            if (!allowed) TextButton(onClick = {
                if (Build.VERSION.SDK_INT >= 33 && androidx.core.content.ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                else context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,context.packageName))
            }) { Text("Enable notifications") }
            if (!precise && Build.VERSION.SDK_INT >= 31) {
                Text("For reminders at the chosen time, allow Hyena in Android’s Alarms & reminders settings. This is separate from notification permission.", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = {
                    try { context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${context.packageName}"))) }
                    catch (_: android.content.ActivityNotFoundException) { message = "Open Android Settings → Apps → Special app access → Alarms & reminders → Hyena." }
                }) { Text("Enable precise reminders") }
            }
            TextButton(enabled = allowed, onClick = {
                message = if (reminders.testNotification(false)) "Test posted. Check your notification shade." else "Couldn't post the test. Check notification settings."
                diagnostic = reminders.diagnostic()
            }) { Text("Send test notification now") }
            TextButton(enabled = allowed, onClick = {
                message = if (reminders.testNotification(true)) "Test scheduled for one minute from now. Lock your phone to check background delivery.${if (!precise) " Android may delay it without precise timing." else ""}" else "Couldn't schedule the test."
                diagnostic = reminders.diagnostic()
            }) { Text("Test reminder in 1 minute") }
            TextButton(onClick = { allowed = reminders.notificationsAllowed(); precise = reminders.exactAllowed(); diagnostic = reminders.diagnostic() }) { Text("Refresh delivery status") }
            Text(diagnostic, style = MaterialTheme.typography.bodySmall)
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
