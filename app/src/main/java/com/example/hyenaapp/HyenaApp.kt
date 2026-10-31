package com.example.hyenaapp

import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.Alignment
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import com.example.hyenaapp.data.repository.AppPreferences
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.data.repository.SavedExperienceCodec
import com.example.hyenaapp.data.repository.SavedExperienceStore
import com.example.hyenaapp.data.repository.displaySchedule
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.DiscoveryFiltersPanel
import com.example.hyenaapp.ui.components.LocationTracker
import com.example.hyenaapp.ui.components.LocationControls
import com.example.hyenaapp.ui.details.ExperienceDetailsScreen
import com.example.hyenaapp.ui.explore.ExploreScreen
import com.example.hyenaapp.ui.home.HomeScreen
import com.example.hyenaapp.ui.submit.SubmitEventScreen
import com.example.hyenaapp.ui.saved.SavedScreen
import java.time.ZoneId
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HyenaApp(preferences: AppPreferences = AppPreferences(), onPreferencesChange: (AppPreferences) -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reminders = remember(context) { com.example.hyenaapp.reminders.EventReminders(context) }
    val savedStore = remember(context) { SavedExperienceStore(context) }
    var savedExperiences by remember { mutableStateOf<List<Experience>>(emptyList()) }
    var savesLoading by remember { mutableStateOf(true) }
    var savesReady by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var savedError by remember { mutableStateOf<String?>(null) }
    var savedReloadKey by remember { mutableStateOf(0) }
    LaunchedEffect(savedStore, savedReloadKey) {
        savesLoading = true
        savesReady = false
        try {
            savedExperiences = savedStore.load()
            reminders.updateSaved(savedExperiences)
            reminders.restore()
            savedError = null
            savesReady = true
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            savedError = "Couldn't read saved experiences. Your existing saved data has been kept."
        } finally { savesLoading = false }
    }
    val toggleSave: (Experience) -> Unit = { experience ->
        if (savesReady && !saving && !savesLoading) {
            saving = true
            scope.launch {
                try {
                    val updated = SavedExperienceCodec.toggle(savedExperiences, experience)
                    savedStore.save(updated)
                    savedExperiences = updated
                    reminders.retainSaved(updated.map { it.id }.toSet())
                    savedError = null
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    savedError = "Couldn't save that change on this phone. Please retry."
                } finally { saving = false }
            }
        }
    }
    val savingEnabled = savesReady && !saving && !savesLoading
    val savedIds = savedExperiences.map { it.id }.toSet()

    var nearby by remember { mutableStateOf<NearbyLocation?>(null) }
    val radiusMiles = preferences.radiusMiles
    var showAppearance by remember { mutableStateOf(false) }
    var timeZone by remember { mutableStateOf(ZoneId.systemDefault().id) }
    var resetKey by remember { mutableStateOf(0) }
    var locationMessage by remember { mutableStateOf("Finding your location…") }
    LocationTracker(resetKey, { nearby = it }, { locationMessage = it })
    val locationControls: @Composable () -> Unit = {
        LocationControls(nearby, radiusMiles, locationMessage, { onPreferencesChange(preferences.copy(radiusMiles = it)) }, { resetKey++ })
    }
    val filters = preferences.filters
    val updateFilters: (DiscoveryFilters) -> Unit = { onPreferencesChange(preferences.copy(filters = it)) }
    val filterControls: @Composable () -> Unit = {
        DiscoveryFiltersPanel(filters, timeZone, updateFilters, onClear = {
            onPreferencesChange(preferences.copy(filters = DiscoveryFilters(), radiusMiles = 10))
        })
    }

    var selectedTab by rememberSaveable { mutableStateOf(if ((context as? android.app.Activity)?.intent?.action == "com.example.hyenaapp.OPEN_SAVED") "Saved" else "Home") }
    var showingSubmission by rememberSaveable { mutableStateOf(false) }
    var showingDetails by rememberSaveable { mutableStateOf(false) }
    var detailId by rememberSaveable { mutableStateOf("") }
    var detailTitle by rememberSaveable { mutableStateOf("") }
    var detailBusiness by rememberSaveable { mutableStateOf("") }
    var detailSchedule by rememberSaveable { mutableStateOf("") }
    var detailOffer by rememberSaveable { mutableStateOf("") }
    var detailStart by rememberSaveable { mutableStateOf<String?>(null) }
    var detailEnd by rememberSaveable { mutableStateOf<String?>(null) }
    var detailLatitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var detailLongitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var detailCategories by rememberSaveable { mutableStateOf("[]") }
    var detailPrice by rememberSaveable { mutableStateOf("Price unknown") }
    val openExperience: (Experience) -> Unit = {
        detailCategories = com.google.gson.Gson().toJson(it.categories.orEmpty())
        detailPrice = it.priceLabel ?: "Price unknown"
        detailLatitude = it.latitude
        detailLongitude = it.longitude
        detailId = it.id
        detailTitle = it.title
        detailBusiness = it.businessName
        detailSchedule = it.schedule
        detailOffer = it.offer
        detailStart = it.occurrenceStart
        detailEnd = it.occurrenceEnd
        showingDetails = true
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(context, lifecycleOwner) {
        val updateZone = {
            val current = ZoneId.systemDefault().id
            if (current != timeZone) { timeZone = current; showingDetails = false }
        }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) updateZone()
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) { updateZone() }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        ContextCompat.registerReceiver(context, receiver, IntentFilter(Intent.ACTION_TIMEZONE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer); context.unregisterReceiver(receiver) }
    }
    BackHandler(enabled = showingDetails || showingSubmission) {
        if (showingSubmission) showingSubmission = false else showingDetails = false
    }

    if (showAppearance) {
        AlertDialog(onDismissRequest = { showAppearance = false }, title = { Text("Appearance") }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Choose your preferred theme. Your choice is saved on this phone.")
                listOf("light" to "Light", "dark" to "Dark").forEach { (value, label) ->
                    Row(Modifier.fillMaxWidth().selectable(selected = preferences.theme == value,
                        onClick = { onPreferencesChange(preferences.copy(theme = value)) }, role = Role.RadioButton),
                        verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = preferences.theme == value, onClick = null)
                        Text(label)
                    }
                }
            }
        }, confirmButton = { TextButton(onClick = { showAppearance = false }) { Text("Done") } })
    }
    Scaffold(topBar = {
        TopAppBar(title = { Text("Hyena", style = MaterialTheme.typography.titleLarge) }, actions = {
            TextButton(onClick = { showAppearance = true }) { Text("Appearance") }
        })
    }, bottomBar = {
        if (!showingDetails && !showingSubmission) {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                listOf("Home", "Explore", "Saved").forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab, onClick = { selectedTab = tab },
                        icon = { Icon(painterResource(when (tab) { "Home" -> R.drawable.ic_home; "Explore" -> R.drawable.ic_explore; else -> R.drawable.ic_saved }), contentDescription = null) }, label = { Text(tab) }
                    )
                }
            }
        }
    }, floatingActionButton = {
        if (!showingDetails && !showingSubmission && selectedTab != "Saved") {
            ExtendedFloatingActionButton(onClick = { showingSubmission = true }, containerColor = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary) { Text("+ Submit event") }
        }
    }) { innerPadding ->
        Column(Modifier.padding(innerPadding).fillMaxSize()) {
            savedError?.let { message ->
                Text(message, modifier = Modifier.padding(horizontal = 24.dp))
                TextButton(enabled = !saving && !savesLoading, onClick = { savedReloadKey++ }) { Text("Retry saved storage") }
            }
            Box(Modifier.weight(1f)) {
                if (showingSubmission) {
                    SubmitEventScreen(nearby = nearby, radiusMiles = radiusMiles, onDone = { showingSubmission = false })
                } else if (showingDetails) {
                    val experience = Experience(detailId, detailTitle, detailBusiness, detailSchedule, detailOffer, detailStart, detailEnd, latitude = detailLatitude, longitude = detailLongitude, priceLabel = detailPrice, categories = com.google.gson.Gson().fromJson(detailCategories, Array<com.example.hyenaapp.domain.model.EventCategory>::class.java).toList())
                    ExperienceDetailsScreen(
                        eventId = detailId, priceLabel = detailPrice,
                        title = detailTitle, businessName = detailBusiness,
                        latitude = detailLatitude, longitude = detailLongitude,
                        schedule = displaySchedule(experience, timeZone), offer = detailOffer,
                        onBack = { showingDetails = false }, isSaved = detailId in savedIds,
                        savingEnabled = savingEnabled, onToggleSave = { toggleSave(experience) }
                    )
                } else when (selectedTab) {
                    "Home" -> HomeScreen(
                        nearby = nearby, radiusMiles = radiusMiles,
                        timeZone = timeZone, locationControls = locationControls,
                        savedIds = savedIds,
                        savingEnabled = savingEnabled, onToggleSave = toggleSave,
                        onExperienceClick = openExperience, onRefreshLocation = { resetKey++ }, onExplore = { selectedTab = "Explore" }
                    )
                    "Explore" -> ExploreScreen(
                        nearby = nearby, radiusMiles = radiusMiles,
                        timeZone = timeZone, locationControls = locationControls,
                        filters = filters, filterControls = filterControls,
                        savedIds = savedIds,
                        savingEnabled = savingEnabled, onToggleSave = toggleSave,
                        onExperienceClick = openExperience
                    )
                    "Saved" -> SavedScreen(
                        experiences = savedExperiences.map { it.copy(distanceMiles = distanceFrom(nearby, it)) }.sortedBy { it.distanceMiles ?: Double.MAX_VALUE }, timeZone = timeZone, loading = savesLoading, available = savesReady,
                        savingEnabled = savingEnabled, onToggleSave = toggleSave,
                        onExperienceClick = openExperience
                    )
                }
            }
        }
    }
}

private fun distanceFrom(location: NearbyLocation?, experience: Experience): Double? {
    if (location == null || experience.latitude == null || experience.longitude == null) return null
    val result = FloatArray(1)
    android.location.Location.distanceBetween(location.latitude, location.longitude, experience.latitude, experience.longitude, result)
    return result[0] / 1609.344
}
