package com.example.hyenaapp.ui.details

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import android.content.Intent
import android.content.ActivityNotFoundException
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.ui.components.PageHeader

@Composable
fun ExperienceDetailsScreen(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    isSaved: Boolean = false,
    savingEnabled: Boolean = true,
    onToggleSave: () -> Unit = {},
    latitude: Double? = null,
    longitude: Double? = null,
    eventId: String = "",
    priceLabel: String = "Price unknown"
) {
    val context = LocalContext.current
    var reportOpen by remember { mutableStateOf(false) }
    var directionsError by remember { mutableStateOf<String?>(null) }
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        TextButton(onClick = onBack) { Text("Back to experiences") }
        PageHeader("Experience / Details", title, businessName)
        DetailSection("When", schedule)
        DetailSection("Price & offer", "$priceLabel\n$offer")
        OutlinedButton(onClick = {
            val map = if (latitude != null && longitude != null) "\nhttps://www.google.com/maps/search/?api=1&query=$latitude,$longitude" else ""
            val text = "$title\n$businessName\n$schedule\n$priceLabel\n$offer$map\nFound on Hyena — community plans, no paid placement."
            try { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text), "Share event")) }
            catch (error: ActivityNotFoundException) { directionsError = "No sharing app is available." }
        }, modifier = Modifier.fillMaxWidth()) { Text("Share event") }
        if (eventId.isNotBlank()) TextButton(onClick = { reportOpen = true }) { Text("Report incorrect details") }
        if (latitude != null && longitude != null && latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0) {
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                val destination = Uri.encode("$latitude,$longitude ($businessName)")
                try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$destination")))
                    directionsError = null
                } catch (error: ActivityNotFoundException) {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude")))
                    } catch (fallback: ActivityNotFoundException) { directionsError = "Install a map app or browser to get directions." }
                }
            }) { Text("Get directions") }
        } else Text("Directions are unavailable because this event has no venue coordinates.", style = MaterialTheme.typography.bodySmall)
        directionsError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = onToggleSave, enabled = savingEnabled, modifier = Modifier.fillMaxWidth()) {
            Text(if (isSaved) "Remove from saved" else "Save this experience")
        }
        Text("Times are shown in your local time. Confirm availability with the venue before visiting.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (reportOpen) EventReportDialog(eventId, onDismiss = { reportOpen = false })
}

@Composable
private fun DetailSection(label: String, value: String) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(label, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            Text(value, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
