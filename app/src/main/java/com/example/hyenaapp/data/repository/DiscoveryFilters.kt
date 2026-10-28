package com.example.hyenaapp.data.repository

/** Shared visitor choices; coordinates are kept separately in memory. */
data class DiscoveryFilters(
    val query: String = "",
    val categoryId: String? = null,
    val window: String = "today",
    val date: String? = null,
    val priceMode: String = "any",
    val maxPrice: String = "25.00",
    val currency: String = "USD"
)
