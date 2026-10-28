package com.example.hyenaapp

import com.example.hyenaapp.data.remote.OccurrenceDto
import com.example.hyenaapp.data.repository.formatOccurrence
import org.junit.Assert.assertEquals
import org.junit.Test

class OccurrenceFormattingTest {
    @Test
    fun formatsVenueTimeRatherThanPhoneTime() {
        val value = OccurrenceDto(
            "2026-10-28T23:00:00Z", "2026-10-29T03:00:00Z",
            "America/Denver", "2026-10-28", "UPCOMING"
        )
        assertEquals("Wed, Oct 28 · 17:00–21:00 · America/Denver", formatOccurrence(value))
    }

    @Test
    fun overnightIncludesEndDate() {
        val value = OccurrenceDto(
            "2026-10-29T05:00:00Z", "2026-10-29T07:00:00Z",
            "America/Denver", "2026-10-28", "UPCOMING"
        )
        assertEquals("Wed, Oct 28 · 23:00–Thu, Oct 29 · 01:00 · America/Denver", formatOccurrence(value))
    }
}
