package com.example.hyenaapp

import com.example.hyenaapp.data.repository.mergeCalendarImport
import com.example.hyenaapp.domain.model.Experience
import org.junit.Assert.assertEquals
import org.junit.Test

class CalendarImportMergeTest {
    private fun event(id: String, start: String = "2030-01-01T18:00:00Z") = Experience(
        "device-calendar:$id", "Studio class", "Open Studio", "Time", "",
        occurrenceStart = start
    )

    @Test fun filtersCopiesAcrossCalendarsAndRepeatedImports() {
        val original = event("1:10")
        val copy = event("2:20").copy(title = "  STUDIO   CLASS ")
        assertEquals(listOf(original), mergeCalendarImport(emptyList(), listOf(original, copy)))
        assertEquals(listOf(original), mergeCalendarImport(listOf(original), listOf(copy, original)))
    }

    @Test fun movesOldOneTimeImportsWithoutChangingTheirSavedId() {
        val old = event("1:10:1893520800000")
        val moved = event("1:10", "2030-01-01T20:00:00Z")
        assertEquals(listOf(moved.copy(id = old.id)), mergeCalendarImport(listOf(old), listOf(moved)))
    }

    @Test fun keepsSeparateRecurringOccurrencesAndDifferentLocations() {
        val first = event("1:10:1893520800000")
        val second = event("1:10:1894125600000", "2030-01-08T18:00:00Z")
        val differentLocation = event("2:20").copy(businessName = "Library")
        assertEquals(
            listOf(first, second, differentLocation),
            mergeCalendarImport(listOf(first), listOf(second, differentLocation))
        )
    }
}
