package com.example.hyenaapp

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.click
import androidx.compose.ui.test.performTouchInput
import com.example.hyenaapp.ui.components.ExperienceCard
import com.example.hyenaapp.ui.theme.HyenaAppTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ExperienceCardTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun cardAndNestedActionsAreIndependent() {
        var opened = 0
        var saved = 0
        val openedUrls = mutableListOf<String>()
        val uriHandler = object : UriHandler {
            override fun openUri(uri: String) {
                openedUrls += uri
            }
        }
        compose.setContent {
            HyenaAppTheme {
                CompositionLocalProvider(LocalUriHandler provides uriHandler) {
                    ExperienceCard(
                        title = "Neighborhood market",
                        businessName = "Civic center",
                        schedule = "Saturday, 10:00 AM",
                        offer = "",
                        priceLabel = "Free",
                        websiteUrl = "https://example.com/market",
                        onClick = { opened++ },
                        onToggleSave = { saved++ }
                    )
                }
            }
        }

        compose.onNodeWithText("Free").assertIsDisplayed()
        compose.onNodeWithText("Save event").performTouchInput { click() }
        compose.onNodeWithText("Visit website").performTouchInput { click() }
        compose.runOnIdle {
            assertEquals(1, saved)
            assertEquals(listOf("https://example.com/market"), openedUrls)
            assertEquals(0, opened)
        }
        compose.onNodeWithText("Neighborhood market", useUnmergedTree = true).performTouchInput { click() }
        compose.runOnIdle { assertEquals(1, opened) }
    }

    @Test
    fun optionalMetadataDoesNotComeBackWhenSavingIsUnavailable() {
        compose.setContent {
            HyenaAppTheme(darkTheme = true) {
                ExperienceCard(
                    title = "Library meetup",
                    businessName = "Library",
                    schedule = "Today, 5:00 PM",
                    offer = "",
                    priceLabel = " Price unknown ",
                    websiteUrl = "content://calendar/events/1",
                    isSaved = true,
                    savingEnabled = false,
                    onToggleSave = {}
                )
            }
        }

        compose.onNodeWithText("Library meetup").assertIsDisplayed()
        compose.onNodeWithText("Today, 5:00 PM").assertIsDisplayed()
        compose.onNodeWithText("Price unknown", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Visit website").assertDoesNotExist()
        compose.onNodeWithText("Remove from saved").assertIsNotEnabled()
    }
}
