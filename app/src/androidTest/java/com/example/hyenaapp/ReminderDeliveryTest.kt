package com.example.hyenaapp

import android.app.NotificationManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.reminders.EventReminders
import org.junit.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID

/** Run on a device with notifications and Alarms & reminders enabled for Hyena. */
@RunWith(AndroidJUnit4::class)
class ReminderDeliveryTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val reminders = EventReminders(context)
    private val manager = context.getSystemService(NotificationManager::class.java)
    private val id = "instrumentation-${UUID.randomUUID()}"
    private fun event(start: Instant = Instant.now().plusSeconds(3600)) = Experience(id,"Delivery test","Test venue","Test time","Free",start.toString(),start.plusSeconds(3600).toString())
    private fun posted() = manager.activeNotifications.any { it.tag == id }
    private fun awaitPosted(): Boolean {
        val deadline = android.os.SystemClock.elapsedRealtime()+3000
        while (!posted() && android.os.SystemClock.elapsedRealtime()<deadline) Thread.sleep(100)
        return posted()
    }
    @After fun cleanup() { reminders.cancel(id) }
    @Test fun notificationPostsAndCancelRemovesIt() {
        assumeTrue("Enable notification permission and the Saved reminders channel",reminders.notificationsAllowed())
        assertTrue(reminders.schedule(event(),15))
        reminders.deliver(id)
        assertTrue(awaitPosted())
        assertNull(reminders.minutes(id))
        reminders.cancel(id)
        assertFalse(posted())
    }
    @Test fun restorationDeliversOverdueReminderWhileEventIsStillRunning() {
        assumeTrue(reminders.notificationsAllowed())
        val start = Instant.now().minusSeconds(60)
        // Simulate a persisted alarm delayed past the event start.
        val json = """{"id":"$id","title":"Overdue test","venue":"Test","start":"$start","minutes":15,"end":"${start.plusSeconds(3600)}"}"""
        context.getSharedPreferences("event_reminders",0).edit().putString(id,json).commit()
        reminders.restore()
        assertTrue(awaitPosted())
    }
    @Test fun alarmManagerInvokesReceiverAndPostsWithoutDirectDeliveryCall() {
        assumeTrue("Enable Alarms & reminders special access before running this test",reminders.exactAllowed())
        assumeTrue(reminders.notificationsAllowed())
        assertTrue(reminders.schedule(event(Instant.now().plusSeconds(62)),1))
        val deadline = android.os.SystemClock.elapsedRealtime()+15000
        while (!posted() && android.os.SystemClock.elapsedRealtime()<deadline) Thread.sleep(100)
        assertTrue("AlarmManager must invoke the manifest receiver and post the notification",posted())
    }
}
