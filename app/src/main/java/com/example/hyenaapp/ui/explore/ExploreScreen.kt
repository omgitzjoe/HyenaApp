package com.example.hyenaapp.ui.explore

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.ExperienceRepository
import com.example.hyenaapp.data.repository.NearbyLocation
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.DiscoveryWindowPicker
import com.example.hyenaapp.ui.components.PageHeader
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import com.example.hyenaapp.ui.components.ExperienceCard
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreScreen(
    modifier: Modifier = Modifier,
    nearby: NearbyLocation? = null,
    radiusMiles: Int = 10,
    timeZone: String = java.time.ZoneId.systemDefault().id,
    locationControls: @Composable () -> Unit = {},
    filters: DiscoveryFilters = DiscoveryFilters(),
    filterControls: @Composable () -> Unit = {},
    onWindowChange: (String) -> Unit = {},
    onDateChange: (String) -> Unit = {},
    savedIds: Set<String> = emptySet(),
    savingEnabled: Boolean = true,
    onToggleSave: (Experience) -> Unit = {},
    onExperienceClick: (Experience) -> Unit = {}
) {
    var experiences by remember {
        mutableStateOf<List<Experience>>(emptyList())
    }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    val query = filters.query.trim()

    LaunchedEffect(filters, nearby, radiusMiles, timeZone, reloadKey) {
        if (nearby == null) { experiences = emptyList(); isLoading = false; errorMessage = null; return@LaunchedEffect }
        isLoading = true
        errorMessage = null

        try {
            if (query.isNotEmpty()) {
                delay(300)
            }

            experiences = ExperienceRepository.getExperiences(query, filters.window, timeZone, nearby, radiusMiles, filters, limit = if (filters.window == "date") 100 else 20)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            errorMessage =
                "Couldn't load experiences. Check your connection and try again."
        } finally {
            isLoading = false
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { PageHeader("Discover / Explore", "Find your kind of good time.", "Search local experiences. Soonest first, then distance when start times match.") }

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
                // The Material picker represents calendar dates at midnight UTC.
                val initialMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
                val state = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
                LaunchedEffect(state.selectedDateMillis, initialMillis) {
                    val millis = state.selectedDateMillis ?: return@LaunchedEffect
                    if (millis != initialMillis) {
                        onDateChange(Instant.ofEpochMilli(millis).atOffset(ZoneOffset.UTC).toLocalDate().toString())
                    }
                }
                DatePicker(state = state, showModeToggle = false)
            }
            item { Text("Events on ${filters.date}", style = MaterialTheme.typography.titleMedium) }
        }

        when {
            nearby == null -> item { Text("Enable location to discover experiences around you.") }
            isLoading -> {
                item {
                    CircularProgressIndicator()
                }
            }

            errorMessage != null -> {
                item {
                    Text(text = errorMessage.orEmpty())
                }

                item {
                    Button(onClick = { reloadKey++ }) {
                        Text(text = "Retry")
                    }
                }
            }

            experiences.isEmpty() -> {
                item {
                    Text(
                        text = if (query.isEmpty()) {
                            "Nothing nearby matches these filters. Try a wider radius, another day, or Clear filters."
                        } else {
                            "Nothing nearby matches your search. Try fewer keywords, a wider radius, or another day."
                        }
                    )
                }
            }

            else -> {
                items(
                    items = experiences,
                    key = { experience -> experience.id }
                ) { experience ->
                    ExperienceCard(
                        categories = experience.categories.orEmpty(), priceLabel = experience.priceLabel ?: "Price unknown",
                    title = experience.title,
                        businessName = experience.businessName,
                        schedule = experience.schedule, distanceMiles = experience.distanceMiles,
                        offer = experience.offer,
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
