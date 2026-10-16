package com.example.hyenaapp.data.repository

import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.domain.model.Experience

object ExperienceRepository {
    suspend fun getExperiences(): List<Experience> {
        return ApiClient.api.getExperiences().items.map { dto ->
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

            Experience(
                id = dto.id,
                title = dto.title,
                businessName = dto.businessName,
                schedule = "$scheduleLabel · " +
                        "${dto.startTime.take(5)}–${dto.endTime.take(5)}" +
                        "$overnightLabel · ${dto.timeZone}",
                offer = offerLabel
            )
        }
    }
}