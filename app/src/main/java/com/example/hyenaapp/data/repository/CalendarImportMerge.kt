package com.example.hyenaapp.data.repository

import com.example.hyenaapp.domain.model.Experience

internal const val DEVICE_CALENDAR_ID_PREFIX = "device-calendar:"

private data class CalendarOccurrence(
    val title: String,
    val location: String,
    val start: String?,
    val end: String?,
    val allDay: Boolean
)

private val whitespace = Regex("\\s+")

private fun Experience.calendarOccurrence() = CalendarOccurrence(
    title.trim().replace(whitespace, " ").lowercase(),
    businessName.trim().replace(whitespace, " ").lowercase(),
    occurrenceStart,
    occurrenceEnd,
    allDay
)

internal fun mergeCalendarImport(
    saved: List<Experience>,
    imported: List<Experience>
): List<Experience> {
    val updated = saved.toMutableList()
    val savedIds = saved.withIndex().associate { (index, event) -> event.id to index }
    val legacyIds = saved.withIndex()
        .filter { (_, event) -> event.id.startsWith(DEVICE_CALENDAR_ID_PREFIX) && event.id.count { it == ':' } == 3 }
        .groupBy { (_, event) -> event.id.substringBeforeLast(':') }
    val unmatched = mutableListOf<Experience>()

    // Apply provider identity matches first so edits to the original event beat copies in other calendars.
    for (event in imported.distinctBy { it.id }) {
        val index = savedIds[event.id] ?: legacyIds[event.id]?.singleOrNull()?.index
        if (index == null) unmatched.add(event)
        else updated[index] = event.copy(id = saved[index].id)
    }

    val occurrences = updated.asSequence()
        .filter { it.id.startsWith(DEVICE_CALENDAR_ID_PREFIX) }
        .map { it.calendarOccurrence() }
        .toHashSet()
    for (event in unmatched) {
        if (occurrences.add(event.calendarOccurrence())) updated.add(event)
    }
    return updated
}
