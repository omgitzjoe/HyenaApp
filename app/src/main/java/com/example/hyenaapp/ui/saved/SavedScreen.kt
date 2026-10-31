package com.example.hyenaapp.ui.saved

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.repository.displaySchedule
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.ui.components.PageHeader
import com.example.hyenaapp.ui.components.ExperienceCard

@Composable
fun SavedScreen(
    experiences: List<Experience>,
    timeZone: String,
    loading: Boolean,
    available: Boolean,
    savingEnabled: Boolean,
    onToggleSave: (Experience) -> Unit,
    onExperienceClick: (Experience) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { PageHeader("Your collection / Saved", "Keep the good ones.", "Your shortlist, saved on this phone. Check current details before heading out.") }
        item { Text("Reminders use the start time saved with each event. Enable precise timing below for timely reminders. Without it, Android may delay delivery. Check current event details if plans change.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { NotificationDiagnostics() }
        when {
            loading -> item { CircularProgressIndicator() }
            !available -> item { Text("Saved experiences could not be loaded. Use Retry saved storage above.") }
            experiences.isEmpty() -> item { Text("Nothing saved yet. Save an experience from Home or Explore.") }
            else -> items(experiences, key = { it.id }) { original ->
                val experience = original.copy(schedule = displaySchedule(original, timeZone))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                ExperienceCard(
                    categories = experience.categories.orEmpty(), priceLabel = experience.priceLabel ?: "Price unknown",
                    title = experience.title, businessName = experience.businessName,
                    schedule = experience.schedule, offer = experience.offer, distanceMiles = experience.distanceMiles,
                    isSaved = true, savingEnabled = savingEnabled,
                    onToggleSave = { onToggleSave(experience) },
                    onClick = { onExperienceClick(experience) }
                )
                ReminderControls(original, savingEnabled)
                }
            }
        }
    }
}
