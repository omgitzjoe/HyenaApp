package com.example.hyenaapp.data.repository

import android.annotation.SuppressLint
import android.content.ContentUris
import android.content.Context
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import android.provider.CalendarContract.Instances
import com.example.hyenaapp.domain.model.Experience
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal const val DEVICE_CALENDAR_ID_PREFIX = "device-calendar:"

internal data class DeviceCalendar(val id: Long, val name: String, val account: String, val primary: Boolean)

@SuppressLint("MissingPermission")
internal suspend fun deviceCalendars(context: Context): List<DeviceCalendar> = withContext(Dispatchers.IO) {
    val columns = arrayOf(Calendars._ID, Calendars.CALENDAR_DISPLAY_NAME, Calendars.ACCOUNT_NAME, Calendars.IS_PRIMARY)
    checkNotNull(context.contentResolver.query(
        Calendars.CONTENT_URI, columns, "${Calendars.VISIBLE} = 1", null, null
    )).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(DeviceCalendar(
                    cursor.getLong(0), cursor.getString(1).orEmpty().ifBlank { "Calendar" },
                    cursor.getString(2).orEmpty(), cursor.getInt(3) == 1
                ))
            }
        }.sortedWith(compareByDescending<DeviceCalendar> { it.primary }.thenBy { it.name })
    }
}

@SuppressLint("MissingPermission")
internal suspend fun calendarExperiences(context: Context, calendar: DeviceCalendar): List<Experience> =
    withContext(Dispatchers.IO) {
        val zone = ZoneId.systemDefault()
        val now = Instant.now()
        val end = now.atZone(zone).plusDays(90).toInstant()
        // All-day instances are stored at UTC midnight. Include adjacent UTC dates before filtering locally.
        val uri = Instances.CONTENT_URI.buildUpon().apply {
            ContentUris.appendId(this, now.minusSeconds(86_400).toEpochMilli())
            ContentUris.appendId(this, end.plusSeconds(86_400).toEpochMilli())
        }.build()
        val columns = arrayOf(
            Instances.EVENT_ID, Instances.BEGIN, Instances.END, Instances.TITLE,
            Instances.EVENT_LOCATION, Instances.ALL_DAY, Instances.STATUS, Instances.SELF_ATTENDEE_STATUS
        )
        val dateFormat = DateTimeFormatter.ofPattern("EEE, MMM d, yyyy")
        checkNotNull(context.contentResolver.query(
            uri, columns, "${Instances.CALENDAR_ID} = ?", arrayOf(calendar.id.toString()), Instances.BEGIN
        )).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    if (cursor.getInt(6) == Events.STATUS_CANCELED ||
                        cursor.getInt(7) == android.provider.CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue
                    val rawStart = Instant.ofEpochMilli(cursor.getLong(1))
                    val rawEnd = Instant.ofEpochMilli(cursor.getLong(2))
                    val allDay = cursor.getInt(5) == 1
                    val title = cursor.getString(3).orEmpty().trim()
                    if (rawEnd < rawStart) continue
                    val startDate = rawStart.atZone(ZoneOffset.UTC).toLocalDate()
                    val endDate = rawEnd.atZone(ZoneOffset.UTC).toLocalDate()
                    val start = if (allDay) startDate.atStartOfDay(zone).toInstant() else rawStart
                    val until = if (allDay) endDate.atStartOfDay(zone).toInstant() else rawEnd
                    if (until < now || start >= end) continue
                    val lastDate = endDate.minusDays(1)
                    val schedule = when {
                        !allDay -> formatInterval(start.toString(), until.toString(), zone)
                        lastDate <= startDate -> "${startDate.format(dateFormat)} · All day"
                        else -> "${startDate.format(dateFormat)} – ${lastDate.format(dateFormat)} · All day"
                    }
                    add(Experience(
                        id = "$DEVICE_CALENDAR_ID_PREFIX${calendar.id}:${cursor.getLong(0)}:${rawStart.toEpochMilli()}",
                        title = title.ifBlank { "Untitled calendar event" },
                        businessName = cursor.getString(4).orEmpty().trim().ifBlank { "Phone calendar" },
                        schedule = schedule,
                        offer = "",
                        occurrenceStart = start.toString(),
                        occurrenceEnd = maxOf(until, start.plusMillis(1)).toString(),
                        allDay = allDay,
                        scheduleKind = "ONCE"
                    ))
                }
            }
        }
    }
