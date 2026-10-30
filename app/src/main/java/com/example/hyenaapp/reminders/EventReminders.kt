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

internal data class EventReminder(val id: String, val title: String, val venue: String, val start: String, val minutes: Int)

class EventReminders(private val context: Context) {
    private val storage = context.getSharedPreferences("event_reminders", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val alarm = context.getSystemService(AlarmManager::class.java)
    private fun records(): List<EventReminder> = storage.all.values.mapNotNull {
        runCatching { gson.fromJson(it as String, EventReminder::class.java) }.getOrNull()
    }
    private fun pending(id: String): PendingIntent = PendingIntent.getBroadcast(context, 0,
        Intent(context, EventReminderReceiver::class.java).setAction("com.example.hyenaapp.REMIND")
            .setData(android.net.Uri.Builder().scheme("hyena-reminder").authority("event").appendPath(id).build()),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun minutes(id: String): Int? = records().firstOrNull { it.id == id }?.minutes
    fun notificationsAllowed(): Boolean {
        val permitted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)
        return permitted && NotificationManagerCompat.from(context).areNotificationsEnabled() && channel?.importance != NotificationManager.IMPORTANCE_NONE
    }
    fun schedule(experience: Experience, minutes: Int): Boolean {
        val trigger = reminderTrigger(experience.occurrenceStart, minutes, System.currentTimeMillis()) ?: return false
        if (!notificationsAllowed()) return false
        val record = EventReminder(experience.id, experience.title, experience.businessName, experience.occurrenceStart!!, minutes)
        storage.edit().putString(record.id, gson.toJson(record)).apply()
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending(record.id))
        return true
    }
    fun cancel(id: String) {
        alarm.cancel(pending(id))
        storage.edit().remove(id).apply()
        NotificationManagerCompat.from(context).cancel(id, 1)
    }
    fun retainSaved(ids: Set<String>) { records().filter { it.id !in ids }.forEach { cancel(it.id) } }
    fun restore() {
        records().forEach { record ->
            val trigger = reminderTrigger(record.start, record.minutes, System.currentTimeMillis())
            if (trigger == null) cancel(record.id)
            else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending(record.id))
        }
    }
    @android.annotation.SuppressLint("MissingPermission")
    fun deliver(id: String) {
        val record = records().firstOrNull { it.id == id } ?: return
        storage.edit().remove(id).apply()
        if (runCatching { Instant.parse(record.start).toEpochMilli() <= System.currentTimeMillis() }.getOrDefault(true)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Saved event reminders", NotificationManager.IMPORTANCE_DEFAULT))
        if (!notificationsAllowed()) return
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java)
            .setAction("com.example.hyenaapp.OPEN_SAVED").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val time = Instant.parse(record.start).atZone(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", java.util.Locale.US))
        NotificationManagerCompat.from(context).notify(id, 1, NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_reminder).setContentTitle(record.title)
            .setContentText("${record.venue} · $time").setStyle(NotificationCompat.BigTextStyle().bigText("${record.venue} · $time"))
            .setContentIntent(open).setAutoCancel(true).build())
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
