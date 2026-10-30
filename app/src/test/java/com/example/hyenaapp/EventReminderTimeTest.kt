package com.example.hyenaapp

import com.example.hyenaapp.reminders.reminderTrigger
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class EventReminderTimeTest {
    @Test fun leadTimeUsesAbsoluteInstantAcrossMidnightAndTimeZones() {
        val now = Instant.parse("2030-01-01T22:00:00Z").toEpochMilli()
        assertEquals(Instant.parse("2030-01-01T23:30:00Z").toEpochMilli(), reminderTrigger("2030-01-02T00:30:00Z", 60, now))
        assertEquals(reminderTrigger("2030-01-02T00:30:00Z", 60, now), reminderTrigger("2030-01-01T17:30:00-07:00", 60, now))
    }
    @Test fun expiredMissingAndInvalidTimesCannotSchedule() {
        val now = Instant.parse("2030-01-02T00:00:00Z").toEpochMilli()
        assertNull(reminderTrigger(null, 15, now))
        assertNull(reminderTrigger("invalid", 15, now))
        assertNull(reminderTrigger("2030-01-02T00:10:00Z", 15, now))
        assertNull(reminderTrigger("2030-01-03T00:00:00Z", 0, now))
    }
}
