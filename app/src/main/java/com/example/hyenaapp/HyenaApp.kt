package com.example.hyenaapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.key
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.time.ZoneId
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.ui.components.DiscoveryFiltersPanel
import com.example.hyenaapp.ui.components.NearbyControls
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.example.hyenaapp.ui.details.ExperienceDetailsScreen
import com.example.hyenaapp.ui.explore.ExploreScreen
import com.example.hyenaapp.ui.home.HomeScreen
import com.example.hyenaapp.ui.saved.SavedScreen

@Composable
fun HyenaApp() {
    val tabs = listOf("Home", "Explore", "Saved")

    var nearby by remember { mutableStateOf<NearbyLocation?>(null) }
    var radiusMiles by rememberSaveable { mutableStateOf(10) }
    var timeZone by remember { mutableStateOf(ZoneId.systemDefault().id) }
    var resetKey by remember { mutableStateOf(0) }
    val locationControls: @Composable () -> Unit = {
        key(resetKey) { NearbyControls(nearby, radiusMiles, { nearby = it }, { radiusMiles = it }) }
        Text("Times shown in $timeZone")
    }

    var selectedAreaId by rememberSaveable { mutableStateOf<String?>(null) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var categoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedWindow by rememberSaveable { mutableStateOf("today") }
    var selectedDate by rememberSaveable { mutableStateOf<String?>(null) }
    var priceMode by rememberSaveable { mutableStateOf("any") }
    var maxPrice by rememberSaveable { mutableStateOf("25.00") }
    var currency by rememberSaveable { mutableStateOf("USD") }
    val filters = DiscoveryFilters(searchQuery, categoryId, selectedWindow, selectedDate, priceMode, maxPrice, currency)
    val updateFilters: (DiscoveryFilters) -> Unit = {
        searchQuery = it.query
        categoryId = it.categoryId
        selectedWindow = it.window
        selectedDate = it.date
        priceMode = it.priceMode
        maxPrice = it.maxPrice
        currency = it.currency
    }
    val filterControls: @Composable () -> Unit = {
        DiscoveryFiltersPanel(filters, timeZone, updateFilters, onClear = {
            resetKey++
            updateFilters(DiscoveryFilters())
            selectedAreaId = null
            nearby = null
            radiusMiles = 10
        })
    }


    var selectedTab by rememberSaveable { mutableStateOf("Home") }
    var showingDetails by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(context, lifecycleOwner) {
        val updateZone = {
            val current = ZoneId.systemDefault().id
            if (current != timeZone) {
                timeZone = current
                showingDetails = false
            }
        }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) updateZone()
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) { updateZone() }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        ContextCompat.registerReceiver(context, receiver, IntentFilter(Intent.ACTION_TIMEZONE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            context.unregisterReceiver(receiver)
        }
    }


    var detailTitle by rememberSaveable { mutableStateOf("") }
    var detailBusiness by rememberSaveable { mutableStateOf("") }
    var detailSchedule by rememberSaveable { mutableStateOf("") }
    var detailOffer by rememberSaveable { mutableStateOf("") }

    BackHandler(enabled = showingDetails) {
        showingDetails = false
    }

    Scaffold(
        bottomBar = {
            if (!showingDetails) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = selectedTab == tab,
                            onClick = { selectedTab = tab },
                            icon = { Text(text = tab.take(1)) },
                            label = { Text(text = tab) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        val screenModifier = Modifier.padding(innerPadding)

        if (showingDetails) {
            ExperienceDetailsScreen(
                title = detailTitle,
                businessName = detailBusiness,
                schedule = detailSchedule,
                offer = detailOffer,
                onBack = { showingDetails = false },
                modifier = screenModifier
            )
        } else {
            when (selectedTab) {
                "Home" -> HomeScreen(
                    modifier = screenModifier,
                    selectedAreaId = selectedAreaId,
                    nearby = nearby,
                    radiusMiles = radiusMiles,
                    timeZone = timeZone,
                    locationControls = locationControls,
                    filters = filters,
                    filterControls = filterControls,
                    onAreaChange = { selectedAreaId = it },
                    onExperienceClick = { title, business, schedule, offer ->
                        detailTitle = title
                        detailBusiness = business
                        detailSchedule = schedule
                        detailOffer = offer
                        showingDetails = true
                    }
                )

                "Explore" -> ExploreScreen(
                    modifier = screenModifier,
                    selectedAreaId = selectedAreaId,
                    nearby = nearby,
                    radiusMiles = radiusMiles,
                    timeZone = timeZone,
                    locationControls = locationControls,
                    filters = filters,
                    filterControls = filterControls,
                    onAreaChange = { selectedAreaId = it },
                    onExperienceClick = { title, business, schedule, offer ->
                        detailTitle = title
                        detailBusiness = business
                        detailSchedule = schedule
                        detailOffer = offer
                        showingDetails = true
                    }
                )
                "Saved" -> SavedScreen(modifier = screenModifier)
            }
        }
    }
}