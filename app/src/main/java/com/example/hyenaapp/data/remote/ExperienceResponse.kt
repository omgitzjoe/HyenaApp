package com.example.hyenaapp.data.remote

data class ExperienceResponse(
    val items: List<ExperienceDto>,
    val count: Int
)

data class ExperienceDto(
    val id: String,
    val title: String,
    val description: String,
    val businessName: String,
    val city: String,
    val priceAmount: String?,
    val currency: String?,
    val offer: String?,
    val scheduleKind: String,
    val startDate: String,
    val endDate: String?,
    val startTime: String,
    val endTime: String,
    val endsNextDay: Boolean,
    val timeZone: String,
    val nextOccurrence: OccurrenceDto? = null,
    val distanceMiles: Double? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val allDay: Boolean = false,
    val categories: List<com.example.hyenaapp.domain.model.EventCategory> = emptyList()
)

data class OccurrenceDto(
    val startsAt: String,
    val endsAt: String,
    val timeZone: String,
    val localDate: String,
    val status: String
)
