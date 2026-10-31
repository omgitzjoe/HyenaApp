package com.example.hyenaapp.domain.model

data class Experience(
    val id: String,
    val title: String,
    val businessName: String,
    val schedule: String,
    val offer: String,
    val occurrenceStart: String? = null,
    val occurrenceEnd: String? = null,
    val distanceMiles: Double? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val categories: List<EventCategory> = emptyList(),
    val priceLabel: String = "Price unknown"
)
data class EventCategory(val id: String, val name: String, val slug: String = "")
