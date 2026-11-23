package com.example.hyenaapp

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import com.example.hyenaapp.data.repository.AppPreferences
import com.example.hyenaapp.data.repository.AppPreferencesCodec
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.domain.model.EventCategory
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.LocationControls
import com.example.hyenaapp.ui.home.HomeScreen
import com.example.hyenaapp.ui.theme.HyenaAppTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeDiscoveryTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun scrollsPastDuplicateApiIdsAndLongMulticategoryCards() {
        val cards = (1..18).map { number ->
            Experience(
                id = number.toString(),
                title = "Event $number",
                businessName = "Community center",
                schedule = "Today, 5:00 PM",
                offer = if (number == 9) "Extra event information. ".repeat(600) else "",
                categories = listOf(
                    EventCategory("art", "Arts and culture"),
                    EventCategory("music", "Live music"),
                    EventCategory("family", "Family events")
                )
            )
        }.toMutableList()
        cards.add(9, cards[8].copy(title = "Repeated event 9"))
        val load: suspend (DiscoveryFilters, NearbyLocation, Int, String) -> List<Experience> =
            { _, _, _, _ -> cards }

        compose.setContent {
            HyenaAppTheme {
                HomeScreen(nearby = NearbyLocation(43.49, -112.04), loadExperiences = load)
            }
        }

        val feed = compose.onNodeWithTag("discovery-feed")
        feed.performScrollToNode(hasText("Event 9"))
        compose.onNodeWithText("Event 9").assertIsDisplayed()
        compose.onNodeWithText("Repeated event 9").assertDoesNotExist()
        feed.performTouchInput { swipeUp() }
        feed.performScrollToNode(hasText("Event 18"))
        compose.onNodeWithText("Event 18").assertIsDisplayed()
    }

    @Test
    fun customDistanceOnlyTriggersSearchAfterValidApplyAndPersists() {
        val location = NearbyLocation(43.49, -112.04)
        val selected = mutableIntStateOf(10)
        val requested = mutableListOf<Int>()
        val load: suspend (DiscoveryFilters, NearbyLocation, Int, String) -> List<Experience> =
            { _, _, radius, _ -> requested.add(radius); emptyList() }
        compose.setContent {
            HyenaAppTheme {
                HomeScreen(
                    nearby = location,
                    radiusMiles = selected.intValue,
                    locationControls = {
                        LocationControls(location, selected.intValue, "Location available", { miles ->
                            val stored = AppPreferencesCodec.encode(AppPreferences(radiusMiles = miles))
                            selected.intValue = AppPreferencesCodec.decode(stored).radiusMiles
                        }, {})
                    },
                    loadExperiences = load
                )
            }
        }
        compose.onNodeWithText("Custom distance").performClick()
        compose.onNode(hasSetTextAction()).performTextReplacement("101")
        compose.onNodeWithText("Apply").assertIsNotEnabled()
        compose.runOnIdle { assertEquals(listOf(10), requested) }

        compose.onNode(hasSetTextAction()).performTextReplacement("1")
        compose.onNodeWithText("Apply").performClick()
        compose.onNodeWithText("Custom distance: 1 mi").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(1, selected.intValue)
            assertEquals(listOf(10, 1), requested)
        }
    }
}
