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
            date = filters.date.takeIf { window == "date" },
            limit = limit
        ).items.map { toExperience(it, timeZone) }
    }
    internal fun toExperience(dto: com.example.hyenaapp.data.remote.ExperienceDto, timeZone: String = ZoneId.systemDefault().id): Experience =
            Experience(
                id = dto.id,
                title = dto.title,
                businessName = dto.businessName,
                schedule = dto.nextOccurrence?.let { if (dto.allDay) "${dto.startDate}${dto.endDate?.takeIf { end -> end != dto.startDate }?.let { end -> "–$end" }.orEmpty()} · All day" else if (dto.endTime == null) formatStart(it.startsAt, ZoneId.of(timeZone)) else formatOccurrence(it, ZoneId.of(timeZone)) }
                    ?: "No dated occurrence available",
                offer = dto.description.orEmpty(),
                occurrenceStart = dto.nextOccurrence?.startsAt,
                occurrenceEnd = dto.nextOccurrence?.endsAt, hasEndTime = dto.endTime != null, allDay = dto.allDay, scheduleKind = dto.scheduleKind,
                distanceMiles = dto.distanceMiles, latitude = dto.latitude, longitude = dto.longitude,
                categories = dto.categories.ifEmpty { listOf(com.example.hyenaapp.domain.model.EventCategory("other", "Other", "other")) }, priceLabel = priceLabel(dto.priceAmount, "USD")
            )
}

internal fun formatStart(startsAt: String, zone: ZoneId): String = Instant.parse(startsAt).atZone(zone).format(DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US))

internal fun formatOccurrence(occurrence: OccurrenceDto, zone: ZoneId = ZoneId.systemDefault()): String {
    return formatInterval(occurrence.startsAt, occurrence.endsAt, zone)
}

internal fun formatInterval(startsAt: String, endsAt: String, zone: ZoneId): String {
    val start = Instant.parse(startsAt).atZone(zone)
    val end = Instant.parse(endsAt).atZone(zone)
    val dateTime = DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)
    val time = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    val endLabel = if (start.toLocalDate() == end.toLocalDate()) {
        end.format(time)
    } else {
        end.format(dateTime)
    }
    return "${start.format(dateTime)}–$endLabel"
}

data class NearbyLocation(val latitude: Double, val longitude: Double)

fun displaySchedule(experience: Experience, timeZone: String): String {
    return if (experience.occurrenceStart != null && experience.occurrenceEnd != null && experience.hasEndTime && !experience.allDay) {
        formatInterval(experience.occurrenceStart, experience.occurrenceEnd, ZoneId.of(timeZone))
    } else experience.schedule
}

internal fun priceLabel(amount: String?, currency: String?): String {
    val value = amount?.toBigDecimalOrNull() ?: return ""
    if (value.signum() == 0) return "Free"
    val number = value.stripTrailingZeros().toPlainString()
    return if (currency == "USD") "$$number" else "$number ${currency.orEmpty()}".trim()
}
