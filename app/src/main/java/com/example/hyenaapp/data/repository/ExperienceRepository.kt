package com.example.hyenaapp.data.repository

import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.data.remote.OccurrenceDto
import com.example.hyenaapp.domain.model.Experience
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object ExperienceRepository {
    suspend fun getExperiences(
        query: String = "",
        window: String = "today",
        timeZone: String = ZoneId.systemDefault().id,
        nearby: NearbyLocation? = null,
        radiusMiles: Int = 10,
        filters: DiscoveryFilters = DiscoveryFilters(),
        limit: Int = 20
    ): List<Experience> {
        requireNotNull(nearby) { "Location is required to discover nearby experiences." }
        return ApiClient.api.getExperiences(
            query, window, timeZone,
            nearby?.latitude, nearby?.longitude, if (nearby != null) radiusMiles else null,
            categoryIds = filters.categoryIds.takeIf { it.isNotEmpty() }?.joinToString(","),
            price = filters.priceMode,
            maxPrice = filters.maxPrice.takeIf { filters.priceMode == "max" },
            currency = "USD".takeIf { filters.priceMode == "max" },
            date = filters.date.takeIf { window == "date" },
            limit = limit
        ).items.map { dto ->
            val offerLabel = dto.offer?.takeIf { it.isNotBlank() }
                ?: dto.priceAmount?.let { amount ->
                    "$amount ${dto.currency.orEmpty()}".trim()
                }
                ?: "Price not listed"

            Experience(
                id = dto.id,
                title = dto.title,
                businessName = dto.businessName,
                schedule = dto.nextOccurrence?.let { formatOccurrence(it, ZoneId.of(timeZone)) }
                    ?: "No dated occurrence available",
                offer = offerLabel,
                occurrenceStart = dto.nextOccurrence?.startsAt,
                occurrenceEnd = dto.nextOccurrence?.endsAt,
                distanceMiles = dto.distanceMiles, latitude = dto.latitude, longitude = dto.longitude
            )
        }
    }
}

internal fun formatOccurrence(occurrence: OccurrenceDto, zone: ZoneId = ZoneId.systemDefault()): String {
    return formatInterval(occurrence.startsAt, occurrence.endsAt, zone)
}

internal fun formatInterval(startsAt: String, endsAt: String, zone: ZoneId): String {
    val start = Instant.parse(startsAt).atZone(zone)
    val end = Instant.parse(endsAt).atZone(zone)
    val dateTime = DateTimeFormatter.ofPattern("EEE, MMM d · HH:mm", Locale.US)
    val time = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
    val endLabel = if (start.toLocalDate() == end.toLocalDate()) {
        end.format(time)
    } else {
        end.format(dateTime)
    }
    return "${start.format(dateTime)}–$endLabel"
}

data class NearbyLocation(val latitude: Double, val longitude: Double)

fun displaySchedule(experience: Experience, timeZone: String): String {
    return if (experience.occurrenceStart != null && experience.occurrenceEnd != null) {
        formatInterval(experience.occurrenceStart, experience.occurrenceEnd, ZoneId.of(timeZone))
    } else experience.schedule
}
