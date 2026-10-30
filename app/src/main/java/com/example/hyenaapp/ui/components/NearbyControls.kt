package com.example.hyenaapp.ui.components

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.CancellationSignal
import android.os.SystemClock
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Modifier
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.hyenaapp.data.repository.NearbyLocation
import kotlin.coroutines.resume
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/** One app-level owner; automatically reacquires a fresh foreground fix on resume/refresh. */
@Composable
fun LocationTracker(refresh: Int, onLocation: (NearbyLocation?) -> Unit, onMessage: (String) -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val latestLocation by rememberUpdatedState(onLocation)
    val latestMessage by rememberUpdatedState(onMessage)
    var locating by remember { mutableStateOf(false) }
    val permitted = {
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
    val locate: () -> Unit = {
        if (!locating) scope.launch {
            locating = true
            latestLocation(null)
            latestMessage("Finding your location…")
            try {
                val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                var fix: Location? = null
                for (provider in listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).filter { manager.isProviderEnabled(it) }) {
                    fix = withTimeoutOrNull(12000L) {
                        suspendCancellableCoroutine<Location?> { continuation ->
                            val signal = CancellationSignal()
                            continuation.invokeOnCancellation { signal.cancel() }
                            LocationManagerCompat.getCurrentLocation(manager, provider, signal, ContextCompat.getMainExecutor(context)) {
                                if (continuation.isActive) continuation.resume(it)
                            }
                        }
                    }
                    if (fix != null && SystemClock.elapsedRealtimeNanos() - fix.elapsedRealtimeNanos in 0L..120_000_000_000L) break
                    fix = null
                }
                latestLocation(fix?.let { NearbyLocation(it.latitude, it.longitude) })
                latestMessage(if (fix == null) "Location unavailable. Enable phone location, then retry." else "Local time · approximate straight-line distances")
            } catch (error: CancellationException) { throw error } catch (error: Exception) { latestLocation(null); latestMessage("Couldn't get your location. Check permission and phone location settings.") } finally { locating = false }
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants.values.any { it }) locate()
        else { latestLocation(null); latestMessage("Location permission is needed to find nearby experiences. Enable it in app settings.") }
    }
    LaunchedEffect(refresh) {
        if (permitted()) locate()
        else if (refresh == 0) permission.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
        else { latestLocation(null); latestMessage("Enable location permission in app settings.") }
    }
    val latestLocate by rememberUpdatedState(locate)
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (permitted()) latestLocate()
                else { latestLocation(null); latestMessage("Location permission is needed to find nearby experiences.") }
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
}

@Composable
fun LocationControls(location: NearbyLocation?, radius: Int, message: String, onRadius: (Int) -> Unit, onRetry: () -> Unit) {
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (location != null) {
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(5, 10, 25, 100).forEach { miles ->
                    FilterChip(selected = radius == miles, onClick = { onRadius(miles) }, label = { Text("$miles mi") })
                }
            }
        } else if (!message.startsWith("Finding")) {
            Row {
                TextButton(onClick = onRetry) { Text("Retry location") }
                TextButton(onClick = { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))) }) { Text("App settings") }
            }
        }
    }
}
