package com.example.hyenaapp.reminders

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.example.hyenaapp.MainActivity
import com.example.hyenaapp.R
import com.example.hyenaapp.domain.model.Experience
import com.google.gson.Gson
import java.time.Instant

internal fun reminderTrigger(start: String?, minutes: Int, now: Long): Long? =
    runCatching { Instant.parse(start).toEpochMilli() - minutes * 60_000L }.getOrNull()
        ?.takeIf { minutes > 0 && it > now }

internal data class EventReminder(val id: String, val title: String, val venue: String, val start: String, val minutes: Int, val end: String? = null)

class EventReminders(private val context: Context) {
    private val storage = context.getSharedPreferences("event_reminders", Context.MODE_PRIVATE)
    private val choices = context.getSharedPreferences("reminder_choices", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val alarm = context.getSystemService(AlarmManager::class.java)
    private fun records(): List<EventReminder> = storage.all.values.mapNotNull {
        runCatching { gson.fromJson(it as String, EventReminder::class.java) }.getOrNull()
    }
    private fun pending(id: String): PendingIntent = PendingIntent.getBroadcast(context, 0,
        Intent(context, EventReminderReceiver::class.java).setAction("com.example.hyenaapp.REMIND")
            .setData(android.net.Uri.Builder().scheme("hyena-reminder").authority("event").appendPath(id).build()),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun exactAllowed(): Boolean = Build.VERSION.SDK_INT < 31 || alarm.canScheduleExactAlarms()
    @android.annotation.SuppressLint("ScheduleExactAlarm")
    private fun setAlarm(trigger: Long, id: String) {
        if (exactAllowed()) {
            try { alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending(id)); return }
            catch (_: SecurityException) { /* Access can be revoked while scheduling. */ }
        }
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending(id))
    }
    private fun status(message: String) {
        val time = java.time.ZonedDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("MMM d, h:mm:ss a",java.util.Locale.US))
        context.getSharedPreferences("reminder_diagnostics", Context.MODE_PRIVATE).edit().putString("last", "$time · $message").apply()
    }
    fun scheduledTime(id: String): String? = records().firstOrNull { it.id == id }?.let {
        runCatching { Instant.parse(it.start).minusSeconds(it.minutes * 60L).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", java.util.Locale.US)) }.getOrNull()
    }
    fun defaultMinutes(): Int = choices.getInt("default", 0)

    fun overrideMinutes(id: String): Int? =
        choices.getInt("event:$id", -1).takeIf { it >= 0 }

    fun setLeadTime(id: String?, minutes: Int?, experiences: List<Experience>) {
        val editor = choices.edit()
        if (id == null) editor.putInt("default", minutes ?: 0)
        else if (minutes == null) editor.remove("event:$id")
        else editor.putInt("event:$id", minutes)
        editor.apply()
        updateSaved(experiences)
    }

    fun minutes(id: String): Int? = records().firstOrNull { it.id == id }?.minutes
    fun notificationsAllowed(): Boolean {
        val permitted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)
        return permitted && NotificationManagerCompat.from(context).areNotificationsEnabled() && channel?.importance != NotificationManager.IMPORTANCE_NONE
    }
    fun schedule(experience: Experience, minutes: Int): Boolean {
        val trigger = reminderTrigger(experience.occurrenceStart, minutes, System.currentTimeMillis()) ?: return false
        val record = EventReminder(experience.id, experience.title, experience.businessName, experience.occurrenceStart!!, minutes, experience.occurrenceEnd)
        val previous = storage.getString(record.id, null)
        if (!storage.edit().putString(record.id, gson.toJson(record)).commit()) return false
        try { setAlarm(trigger, record.id) }
        catch (error: RuntimeException) {
            if (previous == null) storage.edit().remove(record.id).commit() else storage.edit().putString(record.id,previous).commit()
            status("Scheduling failed. Please retry."); return false
        }
        status("Scheduled ${record.title} · ${if (exactAllowed()) "precise" else "approximate"} timing")
        return true
    }
    fun cancel(id: String) {
        alarm.cancel(pending(id))
        storage.edit().remove(id).apply()
        NotificationManagerCompat.from(context).cancel(id, 1)
    }
    fun updateSaved(experiences: List<Experience>) {
        val savedIds = experiences.map { it.id }.toSet()
        val existing = records().associateBy { it.id }
        val editor = choices.edit()
        if (!choices.getBoolean("migrated", false)) {
            // Existing per-event alarms become custom choices.
            existing.values.filter { it.id in savedIds }.forEach {
                editor.putInt("event:${it.id}", it.minutes)
            }
            editor.putBoolean("migrated", true)
        }
        choices.all.keys.filter { it.startsWith("event:") && it.removePrefix("event:") !in savedIds }
            .forEach { editor.remove(it) }
        editor.apply()

        existing.keys.filter { it !in savedIds }.forEach(::cancel)
        experiences.forEach { experience ->
            val minutes = overrideMinutes(experience.id) ?: defaultMinutes()
            val previous = existing[experience.id]
            if (minutes > 0 && previous != null &&
                previous.minutes == minutes && previous.start == experience.occurrenceStart
            ) {
                if (previous.end != experience.occurrenceEnd) {
                    val updated = previous.copy(end = experience.occurrenceEnd)
                    storage.edit().putString(previous.id, gson.toJson(updated)).commit()
                }
            } else if (reminderTrigger(experience.occurrenceStart, minutes, System.currentTimeMillis()) != null) {
                schedule(experience, minutes)
            } else if (previous != null) {
                cancel(experience.id)
            }
        }
    }

    fun restore() {
        records().forEach { record ->
            if (record.id == "notification-test") {
                cancel(record.id)
                return@forEach
            }
            val now = System.currentTimeMillis()
            val trigger = runCatching { Instant.parse(record.start).toEpochMilli() - record.minutes * 60_000L }.getOrNull()
            val end = runCatching { Instant.parse(record.end ?: record.start).toEpochMilli() }.getOrNull()
            if (trigger == null || end == null || end <= now) cancel(record.id)
            else if (trigger <= now) deliver(record.id)
            else runCatching { setAlarm(trigger,record.id) }.onFailure { status("Could not restore ${record.title}; reopen Saved and set its reminder again.") }
        }
    }
    @android.annotation.SuppressLint("MissingPermission")
    fun deliver(id: String) {
        if (id == "notification-test") {
            cancel(id)
            return
        }
        val record = records().firstOrNull { it.id == id } ?: return
        val end = runCatching { Instant.parse(record.end ?: record.start).toEpochMilli() }.getOrNull()
        if (end == null || end <= System.currentTimeMillis()) { cancel(id); status("Expired event reminder discarded: ${record.title}"); return }
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Saved event reminders", NotificationManager.IMPORTANCE_DEFAULT))
        if (!notificationsAllowed()) { status("Delivery blocked by Android notification settings: ${record.title}"); return }
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java)
            .setAction("com.example.hyenaapp.OPEN_SAVED").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val time = Instant.parse(record.start).atZone(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", java.util.Locale.US))
        try {
        NotificationManagerCompat.from(context).notify(id, 1, NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_reminder).setContentTitle(record.title)
            .setContentText("${record.venue} · $time").setStyle(NotificationCompat.BigTextStyle().bigText("${record.venue} · $time"))
            .setContentIntent(open).setAutoCancel(true).build())
        alarm.cancel(pending(id))
        storage.edit().remove(id).commit()
        status("Notification posted to Android: ${record.title}")
        } catch (error: SecurityException) { status("Notification permission was revoked: ${record.title}") }
    }
    companion object {
        const val CHANNEL = "saved_events"
    }
}

class EventReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val reminders = EventReminders(context)
        if (intent.action == "com.example.hyenaapp.REMIND") intent.data?.lastPathSegment?.let { reminders.deliver(it) }
        else reminders.restore()
    }
}
