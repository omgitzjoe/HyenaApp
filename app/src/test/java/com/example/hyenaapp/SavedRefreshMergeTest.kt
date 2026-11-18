package com.example.hyenaapp

import com.example.hyenaapp.data.repository.mergeSavedRefresh
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.reminders.reminderIsDue
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class SavedRefreshMergeTest {
    private fun event(id: String) = Experience(id, "Event", "Venue", "Time", "")
    @Test fun refreshPreservesNewSelectionsAndNeverResurrectsRemovedSaves() {
        val current = listOf(event("one"), event("new"))
        val updated = event("one").copy(title = "Rescheduled")
        val result = mergeSavedRefresh(current, listOf(updated, event("removed")), emptySet())
        assertEquals(listOf(updated, event("new")), result)
        assertEquals(listOf(event("new")), mergeSavedRefresh(current, emptyList(), setOf("one")))
        assertEquals(current, mergeSavedRefresh(current, emptyList(), emptySet()))
    }
    @Test fun oldAlarmDoesNotDeliverEarlyAfterRescheduling() {
        val now = Instant.parse("2030-01-01T18:00:00Z").toEpochMilli()
        assertFalse(reminderIsDue("2030-01-01T21:00:00Z", 60, now))
        assertTrue(reminderIsDue("2030-01-01T19:00:00Z", 60, now))
        assertFalse(reminderIsDue("invalid", 60, now))
    }
}
