package com.example.hyenaapp.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.data.remote.EventReportRequest
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

@Composable
internal fun EventReportDialog(eventId: String, onDismiss: () -> Unit) {
    var reason by remember { mutableStateOf("CANCELLED") }
    var details by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var sent by remember { mutableStateOf(false) }
    var failureMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val reasons = listOf(
        "CANCELLED" to "Canceled event",
        "WRONG_TIME" to "Incorrect date or time",
        "WRONG_LOCATION" to "Incorrect location",
        "WRONG_PRICE" to "Incorrect price",
        "OTHER" to "Other issue"
    )
    AlertDialog(
        onDismissRequest = { if (!sending) onDismiss() },
        title = { Text("Report incorrect details") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (sent) {
                    Text("Thanks for helping. A curator will review your report. The listing stays unchanged until reviewed.")
                } else {
                    Text("No account needed. Please avoid including personal information.")
                    reasons.forEach { option ->
                        FilterChip(
                            selected = reason == option.first,
                            onClick = { reason = option.first },
                            enabled = !sending,
                            label = { Text(option.second) }
                        )
                    }
                    OutlinedTextField(
                        value = details,
                        onValueChange = { details = it.take(1000) },
                        enabled = !sending,
                        label = { Text("Details (optional)") },
                        supportingText = { Text("${details.length}/1000") }
                    )
                    failureMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            }
        },
        confirmButton = {
            if (sent) {
                TextButton(onClick = onDismiss) { Text("Done") }
            } else {
                TextButton(
                    enabled = !sending,
                    onClick = {
                        sending = true
                        failureMessage = null
                        scope.launch {
                            try {
                                ApiClient.api.reportEvent(EventReportRequest(eventId, reason, details.trim()))
                                sent = true
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (failure: Exception) {
                                failureMessage = "Couldn't send the report. Please check your connection and retry."
                            } finally {
                                sending = false
                            }
                        }
                    }
                ) { Text(if (sending) "Sending…" else "Send report") }
            }
        },
        dismissButton = {
            if (!sent) {
                TextButton(enabled = !sending, onClick = onDismiss) { Text("Cancel") }
            }
        }
    )
}
