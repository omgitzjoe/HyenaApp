package com.example.hyenaapp.ui.saved

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.displaySchedule
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.ExperienceCard
import com.example.hyenaapp.ui.components.PageHeader
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@Composable
fun SavedScreen(
    experiences: List<Experience>,
    timeZone: String,
    loading: Boolean,
    available: Boolean,
    savingEnabled: Boolean,
    onToggleSave: (Experience) -> Unit,
    onExperienceClick: (Experience) -> Unit,
    modifier: Modifier = Modifier,
    reminderSettings: @Composable () -> Unit = {}
) {
    val zone = ZoneId.of(timeZone)
    var calendar by rememberSaveable { mutableStateOf(false) }
    var selectedDate by rememberSaveable { mutableStateOf(LocalDate.now(zone).toString()) }
    val date = LocalDate.parse(selectedDate)
    var displayedMonth by rememberSaveable { mutableStateOf(YearMonth.from(date).toString()) }
    val month = YearMonth.parse(displayedMonth)
    val occurrences = experiences.mapNotNull { event ->
        val from = event.occurrenceStart?.let(Instant::parse)
        val until = event.occurrenceEnd?.let(Instant::parse)
        if (from != null && until != null) Triple(event, from, until) else null
    }
    fun onDay(day: LocalDate): List<Experience> {
        val start = day.atStartOfDay(zone).toInstant()
        val end = day.plusDays(1).atStartOfDay(zone).toInstant()
        return occurrences.filter { (_, from, until) -> from < end && until > start }
            .sortedBy { it.second }.map { it.first }
    }
    val visible = if (calendar) onDay(date) else experiences
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { PageHeader("Saved", "Your plans", "Browse your saved events and manage reminders.") }
        item { reminderSettings() }
        item {
            TabRow(selectedTabIndex = if (calendar) 1 else 0) {
                Tab(selected = !calendar, onClick = { calendar = false }, text = { Text("List") })
                Tab(selected = calendar, onClick = { calendar = true }, text = { Text("Calendar") })
            }
        }
        if (calendar) {
            item(key = "saved-calendar") {
                val counts = (1..month.lengthOfMonth()).associate { day ->
                    val cell = month.atDay(day)
                    cell to onDay(cell).size
                }
                SavedCalendar(date, month, counts, { next ->
                    displayedMonth = next.toString()
                    selectedDate = next.atDay(1).toString()
                }, { selectedDate = it.toString() })
            }
            item { Text(date.format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))) }
        }
        when {
            loading -> item { CircularProgressIndicator() }
            !available -> item { Text("Saved experiences could not be loaded. Use Retry saved storage above.") }
            experiences.isEmpty() -> item { Text("Nothing saved yet. Save an experience from Home.") }
            visible.isEmpty() -> item { Text("No saved events on this date.") }
            else -> items(visible, key = { it.id }) { original ->
                val experience = original.copy(schedule = displaySchedule(original, timeZone))
                ExperienceCard(
                    categories = experience.categories, priceLabel = experience.priceLabel,
                    title = experience.title, businessName = experience.businessName,
                    schedule = experience.schedule, offer = experience.offer, distanceMiles = experience.distanceMiles,
                    isSaved = true, savingEnabled = savingEnabled,
                    onToggleSave = { onToggleSave(experience) },
                    onClick = { onExperienceClick(experience) }
                )
            }
        }
    }
}
