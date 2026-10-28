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
        areaId: String? = null
    ): List<Experience> {
        return ApiClient.api.getExperiences(query, window, areaId).items.map { dto ->
            val scheduleLabel = when (dto.scheduleKind) {
                "ONCE" -> "One-time · ${dto.startDate.take(10)}"
                else -> "Weekly"
            }

            val overnightLabel =
                if (dto.endsNextDay) " (ends next day)" else ""

            val offerLabel = dto.offer?.takeIf { it.isNotBlank() }
                ?: dto.priceAmount?.let { amount ->
                    "$amount ${dto.currency.orEmpty()}".trim()
                }
                ?: "Price not listed"

            val fallbackSchedule = "$scheduleLabel · " +
                "${dto.startTime.take(5)}–${dto.endTime.take(5)}" +
                "$overnightLabel · ${dto.timeZone}"

            Experience(
                id = dto.id,
                title = dto.title,
                businessName = dto.businessName,
                schedule = dto.nextOccurrence?.let(::formatOccurrence)
                    ?: fallbackSchedule,
                offer = offerLabel
            )
        }
    }
}

internal fun formatOccurrence(occurrence: OccurrenceDto): String {
    val zone = ZoneId.of(occurrence.timeZone)
    val start = Instant.parse(occurrence.startsAt).atZone(zone)
    val end = Instant.parse(occurrence.endsAt).atZone(zone)
    val dateTime = DateTimeFormatter.ofPattern("EEE, MMM d · HH:mm", Locale.US)
    val time = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
    val endLabel = if (start.toLocalDate() == end.toLocalDate()) {
        end.format(time)
    } else {
        end.format(dateTime)
    }
    return "${start.format(dateTime)}–$endLabel · ${occurrence.timeZone}"
}
