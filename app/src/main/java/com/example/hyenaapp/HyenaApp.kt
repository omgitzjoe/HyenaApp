package com.example.hyenaapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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

    var selectedTab by rememberSaveable { mutableStateOf("Home") }
    var showingDetails by rememberSaveable { mutableStateOf(false) }

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
                    onExperienceClick = { title, business, schedule, offer ->
                        detailTitle = title
                        detailBusiness = business
                        detailSchedule = schedule
                        detailOffer = offer
                        showingDetails = true
                    }
                )

                "Explore" -> ExploreScreen(modifier = screenModifier)
                "Saved" -> SavedScreen(modifier = screenModifier)
            }
        }
    }
}