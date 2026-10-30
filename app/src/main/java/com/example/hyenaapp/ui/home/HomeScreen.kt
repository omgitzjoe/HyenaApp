package com.example.hyenaapp.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
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
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.PageHeader
import com.example.hyenaapp.ui.components.ExperienceCard
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.coroutines.cancellation.CancellationException

@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    nearby: NearbyLocation? = null,
    radiusMiles: Int = 10,
    timeZone: String = ZoneId.systemDefault().id,
    locationControls: @Composable () -> Unit = {},
    savedIds: Set<String> = emptySet(),
    savingEnabled: Boolean = true,
    onToggleSave: (Experience) -> Unit = {},
    onExperienceClick: (Experience) -> Unit = {},
    onRefreshLocation: () -> Unit = {},
    onExplore: () -> Unit = {}
) {
    var experiences by remember { mutableStateOf<List<Experience>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }
    var refreshedAt by remember { mutableStateOf<String?>(null) }

    // Home has its own Today query; Explore's category, price, date and search never affect it.
    LaunchedEffect(nearby, radiusMiles, timeZone, reloadKey) {
        if (nearby == null) { experiences = emptyList(); loading = false; error = null; return@LaunchedEffect }
        loading = true
        error = null
        try {
            experiences = ExperienceRepository.getExperiences(
                window = "today", timeZone = timeZone,
                nearby = nearby, radiusMiles = radiusMiles, limit = 12
            )
            refreshedAt = ZonedDateTime.now(ZoneId.of(timeZone)).format(DateTimeFormatter.ofPattern("h:mm:ss a", java.util.Locale.US))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            error = "Couldn't refresh today's experiences. Check your connection and try again."
        } finally {
            loading = false
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { PageHeader("Hyena / Today", "Good plans, close by.", "Today’s next 12 experiences. Soonest first, with distance breaking time ties.", mascot = true) }
        item { locationControls() }
        item {
            Button(onClick = { onRefreshLocation(); reloadKey++ }, enabled = !loading) { Text("Refresh") }
            refreshedAt?.let { Text("Last updated $it") }
        }
        item { Button(onClick = onExplore) { Text("Search and filter in Explore") } }
        when {
            nearby == null -> item { Text("Enable location to discover experiences around you.") }
            loading -> item { CircularProgressIndicator() }
            error != null -> item { Text(error.orEmpty()) }
            experiences.isEmpty() -> item { Text("No more experiences today in this location. Try another date or a wider distance in Explore.") }
            else -> items(experiences, key = { it.id }) { experience ->
                ExperienceCard(
                    title = experience.title, businessName = experience.businessName,
                    schedule = experience.schedule, distanceMiles = experience.distanceMiles, offer = experience.offer,
                    onClick = { onExperienceClick(experience) },
                    isSaved = experience.id in savedIds, savingEnabled = savingEnabled,
                    onToggleSave = { onToggleSave(experience) }
                )
            }
        }
    }
}
