package com.example.hyenaapp.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.DEFAULT_DISCOVERY_RADIUS_MILES
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.data.repository.ExperienceRepository
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.DiscoveryWindowPicker
import com.example.hyenaapp.ui.components.EventCalendar
import com.example.hyenaapp.ui.components.ExperienceCard
import com.example.hyenaapp.ui.components.PageHeader
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

@Composable
internal fun HomeScreen(
    modifier: Modifier = Modifier,
    nearby: NearbyLocation? = null,
    radiusMiles: Int = DEFAULT_DISCOVERY_RADIUS_MILES,
    timeZone: String = java.time.ZoneId.systemDefault().id,
    locationControls: @Composable () -> Unit = {},
    filters: DiscoveryFilters = DiscoveryFilters(),
    filterControls: @Composable () -> Unit = {},
    onWindowChange: (String) -> Unit = {},
    onDateChange: (String) -> Unit = {},
    savedIds: Set<String> = emptySet(),
    savingEnabled: Boolean = true,
    onToggleSave: (Experience) -> Unit = {},
    onExperienceClick: (Experience) -> Unit = {},
    loadExperiences: suspend (DiscoveryFilters, NearbyLocation, Int, String) -> List<Experience> = ::loadDiscoverableExperiences
) {
    var experiences by remember {
        mutableStateOf<List<Experience>>(emptyList())
    }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    val query = filters.query.trim()

    LaunchedEffect(filters, nearby, radiusMiles, timeZone, reloadKey, loadExperiences) {
        if (nearby == null) {
            experiences = emptyList()
            isLoading = false
            errorMessage = null
            return@LaunchedEffect
        }
        isLoading = true
        errorMessage = null

        try {
            if (query.isNotEmpty()) {
                delay(300)
            }

            // The feed shows one card per event. Duplicate IDs would crash a lazy list
            // once two copies of the same item are composed together.
            experiences = loadExperiences(filters, nearby, radiusMiles, timeZone).distinctBy { it.id }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            errorMessage =
                "Check your connection and try again."
        } finally {
            isLoading = false
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().testTag("discovery-feed"),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { PageHeader("Events near you", "See what’s on nearby, soonest first.", mascot = true) }

        item { locationControls() }
        item {
            DiscoveryWindowPicker(
                selectedWindow = filters.window,
                onWindowChange = onWindowChange,
                onCalendarClick = {
                    if (filters.window != "date") {
                        onDateChange(LocalDate.now(ZoneId.of(timeZone)).toString())
                    }
                }
            )
        }
        item { filterControls() }
        if (filters.window == "date") {
            item(key = "calendar") {
                val date = filters.date?.let(LocalDate::parse) ?: LocalDate.now(ZoneId.of(timeZone))
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    EventCalendar(date, onDateChange)
                    val label = date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG))
                    Text("Events on $label", style = MaterialTheme.typography.titleMedium)
                }
            }
        }

        when {
            nearby == null -> item {
                DiscoveryStatus(
                    title = "Waiting for location",
                    description = "Nearby events appear once your location is available."
                )
            }

            isLoading -> item {
                DiscoveryStatus(title = "Finding events", loading = true)
            }

            errorMessage != null -> item {
                DiscoveryStatus(
                    title = "Couldn’t load events",
                    description = errorMessage.orEmpty(),
                    onRetry = { reloadKey++ }
                )
            }

            experiences.isEmpty() -> item {
                DiscoveryStatus(
                    title = if (query.isEmpty()) "No events found" else "No matching events",
                    description = if (query.isEmpty()) {
                        "Try a wider radius, a different day, or clear your filters."
                    } else {
                        "Try fewer search terms, a wider radius, or a different day."
                    }
                )
            }

            else -> {
                items(
                    items = experiences,
                    key = { experience -> "event:${experience.id}" }
                ) { experience ->
                    ExperienceCard(
                        title = experience.title,
                        businessName = experience.businessName,
                        schedule = experience.schedule,
                        categories = experience.categories.orEmpty(),
                        priceLabel = experience.priceLabel.orEmpty(),
                        distanceMiles = experience.distanceMiles,
                        offer = experience.offer,
                        websiteUrl = experience.websiteUrl,
                        onClick = { onExperienceClick(experience) },
                        isSaved = experience.id in savedIds,
                        savingEnabled = savingEnabled,
                        onToggleSave = { onToggleSave(experience) }
                    )
                }
            }
        }
    }
}

private suspend fun loadDiscoverableExperiences(
    filters: DiscoveryFilters,
    nearby: NearbyLocation,
    radiusMiles: Int,
    timeZone: String
): List<Experience> = ExperienceRepository.getExperiences(
    query = filters.query.trim(),
    window = filters.window,
    timeZone = timeZone,
    nearby = nearby,
    radiusMiles = radiusMiles,
    filters = filters,
    limit = if (filters.window == "date") 100 else 20
)

@Composable
private fun DiscoveryStatus(
    title: String,
    description: String? = null,
    loading: Boolean = false,
    onRetry: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (description != null) {
                Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (loading) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
            if (onRetry != null) {
                OutlinedButton(onClick = onRetry) { Text("Try again") }
            }
        }
    }
}
