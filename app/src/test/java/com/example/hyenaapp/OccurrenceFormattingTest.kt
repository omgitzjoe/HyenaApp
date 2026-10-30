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
        assertEquals("Wed, Oct 28 · 5:00 PM–9:00 PM", formatOccurrence(value, ZoneId.of("America/Denver")))
    }

    @Test
    fun overnightIncludesEndDate() {
        val value = OccurrenceDto(
            "2026-10-29T05:00:00Z", "2026-10-29T07:00:00Z",
            "America/Denver", "2026-10-28", "UPCOMING"
        )
        assertEquals("Wed, Oct 28 · 11:00 PM–Thu, Oct 29 · 1:00 AM", formatOccurrence(value, ZoneId.of("America/Denver")))
    }
    @Test
    fun conversionCanChangeCalendarDate() {
        val value = OccurrenceDto("2026-10-29T01:00:00Z", "2026-10-29T02:00:00Z", "UTC", "2026-10-29", "UPCOMING")
        assertEquals("Wed, Oct 28 · 7:00 PM–8:00 PM", formatOccurrence(value, ZoneId.of("America/Denver")))
    }
    @Test
    fun midnightAndNoonUseTwelveWithTheCorrectMeridian() {
        val value = OccurrenceDto("2026-10-28T00:00:00Z", "2026-10-28T12:00:00Z", "UTC", "2026-10-28", "UPCOMING")
        assertEquals("Wed, Oct 28 · 12:00 AM–12:00 PM", formatOccurrence(value, ZoneId.of("UTC")))
    }
}
