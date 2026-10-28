package com.example.hyenaapp.ui.components

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import android.os.CancellationSignal
import com.example.hyenaapp.data.repository.NearbyLocation
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

@Composable
fun NearbyControls(
    nearby: NearbyLocation?,
    radiusMiles: Int,
    onLocationChange: (NearbyLocation?) -> Unit,
    onRadiusChange: (Int) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val locate: () -> Unit = {
        scope.launch {
            loading = true
            message = null
            try {
                val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
                    .filter { manager.isProviderEnabled(it) }
                var fix: Location? = null
                for (provider in providers) {
                    fix = withTimeoutOrNull(12000L) {
                        suspendCancellableCoroutine<Location?> { continuation ->
                            val signal = CancellationSignal()
                            continuation.invokeOnCancellation { signal.cancel() }
                            LocationManagerCompat.getCurrentLocation(
                                manager, provider, signal, ContextCompat.getMainExecutor(context)
                            ) { location -> if (continuation.isActive) continuation.resume(location) }
                        }
                    }
                    if (fix != null && SystemClock.elapsedRealtimeNanos() - fix.elapsedRealtimeNanos in 0L..120_000_000_000L) break
                    fix = null
                }
                onLocationChange(fix?.let { NearbyLocation(it.latitude, it.longitude) })
                if (fix == null) message = "Location unavailable. Enable phone location, retry, or choose an area."
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                onLocationChange(null)
                message = "Couldn't get location. Retry or choose an area."
            } finally {
                loading = false
            }
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true || grants[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            locate()
        } else {
            onLocationChange(null)
            message = "Location permission wasn't granted. Choose an area, or enable permission in app settings."
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Find experiences near you. Your location is used for this search.")
        OutlinedButton(enabled = !loading, onClick = {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                locate()
            } else {
                permission.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
            }
        }) { Text(if (loading) "Finding location…" else if (nearby == null) "Near me" else "Refresh location") }
        if (nearby != null) {
            Text("Within $radiusMiles miles of your captured location. Refresh after moving. Approximate location may affect results.")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(5, 10, 25).forEach { miles ->
                    FilterChip(selected = radiusMiles == miles, onClick = { onRadiusChange(miles) }, label = { Text("$miles mi") })
                }
            }
            TextButton(onClick = { onLocationChange(null) }) { Text("Choose an area instead") }
        }
        message?.let { Text(it) }
    }
}
