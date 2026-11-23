package com.example.hyenaapp.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.domain.model.EventCategory
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ExperienceCard(
    title: String,
    businessName: String,
    schedule: String,
    offer: String,
    distanceMiles: Double? = null,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
    isSaved: Boolean = false,
    savingEnabled: Boolean = true,
    onToggleSave: (() -> Unit)? = null,
    categories: List<EventCategory> = emptyList(),
    priceLabel: String = "",
    websiteUrl: String? = null
) {
    val colors = MaterialTheme.colorScheme
    val type = MaterialTheme.typography
    val visibleCategories = categories.distinctBy { it.id }.sortedBy { it.name }
    val distance = distanceMiles?.let {
        if (it < 0.1) "<0.1 mi" else String.format(Locale.US, "%.1f mi", it)
    }
    val venue = listOfNotNull(businessName.takeIf { it.isNotBlank() }, distance).joinToString(" · ")
    val price = priceLabel.trim().takeUnless { it.isEmpty() || it.equals("Price unknown", ignoreCase = true) }
    val website = websiteUrl?.takeIf { it.startsWith("https://") || it.startsWith("http://") }

    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(1.dp, colors.outlineVariant)
    ) {
        if (visibleCategories.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().height(3.dp)) {
                visibleCategories.forEach { category ->
                    Box(Modifier.weight(1f).fillMaxHeight().background(categoryColor(category)))
                }
            }
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = type.titleLarge)
            Text(schedule, style = type.bodyMedium, color = colors.primary)
            if (venue.isNotBlank()) {
                Text(venue, style = type.bodyMedium, color = colors.onSurfaceVariant)
            }
            if (visibleCategories.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    visibleCategories.forEach { CategoryChip(it) }
                }
            }
            if (price != null) {
                Text(price, style = type.labelLarge, color = colors.primary)
            }
            if (offer.isNotBlank()) {
                Text(offer, style = type.bodyMedium, color = colors.onSurfaceVariant)
            }
        }
        if (website != null || onToggleSave != null) {
            // Separate rows let actions wrap at larger font sizes.
            Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp)) {
                if (website != null) {
                    val uriHandler = LocalUriHandler.current
                    TextButton(onClick = {
                        try {
                            uriHandler.openUri(website)
                        } catch (_: IllegalArgumentException) {
                            // No installed app can open the website.
                        }
                    }) { Text("Visit website") }
                }
                if (onToggleSave != null) {
                    TextButton(
                        onClick = onToggleSave,
                        enabled = savingEnabled,
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text(if (isSaved) "Remove from saved" else "Save event")
                    }
                }
            }
        }
    }
}
