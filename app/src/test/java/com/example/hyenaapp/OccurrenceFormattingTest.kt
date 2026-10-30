package com.example.hyenaapp

import com.example.hyenaapp.data.remote.OccurrenceDto
import com.example.hyenaapp.data.repository.formatOccurrence
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZoneId

class OccurrenceFormattingTest {
    @Test
    fun formatsInViewerZone() {
        val value = OccurrenceDto(
            "2026-10-28T23:00:00Z", "2026-10-29T03:00:00Z",
            "America/New_York", "2026-10-28", "UPCOMING"
        )
        assertEquals("Wed, Oct 28 · 17:00–21:00", formatOccurrence(value, ZoneId.of("America/Denver")))
    }

    @Test
    fun overnightIncludesEndDate() {
        val value = OccurrenceDto(
            "2026-10-29T05:00:00Z", "2026-10-29T07:00:00Z",
            "America/Denver", "2026-10-28", "UPCOMING"
        )
        assertEquals("Wed, Oct 28 · 23:00–Thu, Oct 29 · 01:00", formatOccurrence(value, ZoneId.of("America/Denver")))
    }
    @Test
    fun conversionCanChangeCalendarDate() {
        val value = OccurrenceDto("2026-10-29T01:00:00Z", "2026-10-29T02:00:00Z", "UTC", "2026-10-29", "UPCOMING")
        assertEquals("Wed, Oct 28 · 19:00–20:00", formatOccurrence(value, ZoneId.of("America/Denver")))
    }
}
