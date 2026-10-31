# Saved event reminders and directions

Saved cards offer 15 minutes, 30 minutes, 1 hour, 2 hours, or 1 day before the saved occurrence. Each event has an independent reminder; setting another lead time replaces it. Removing a saved event cancels the alarm and any visible notification. Reminders are stored privately on this phone, use absolute UTC occurrence instants, and do not depend on discovery filters or the displayed timezone.

Android 13+ asks for POST_NOTIFICATIONS only when a reminder is requested. Denial leaves the reminder unscheduled; notification settings remain accessible. App and channel notification settings are checked before scheduling and delivery. Saved offers Alarms & reminders special access for precise setExactAndAllowWhileIdle delivery, with a clearly labeled inexact fallback when access is unavailable. Notification tests and last delivery status are available on Saved. Reboot, app upgrade, and manual clock changes restore future alarms. Overdue reminder times are delivered during restoration while the saved occurrence is still running. Events that have ended do not generate late notifications. Force-stopping the app prevents delivery until the app is opened again.

Reminders refer to the occurrence snapshot the user saved, not every recurrence. Backend reschedules/cancellations are not automatically synchronized; the screen advises checking current details. Opening a notification opens Saved. No new backend service or dependency is needed.

Event details include Get directions when valid coordinates exist. ACTION_VIEW with a geo URI opens the default compatible map app or Android's app selection prompt. The destination pin includes the venue name; the user can start navigation there. Without a map handler, an HTTPS directions URL opens in a browser. Missing coordinates and unavailable apps have explicit feedback.

## Verification

See Community_Cards_and_Reminder_Reliability.md for the latest audit, instrumentation tests, and device verification steps. Kotlin parser, manifest/resource XML parsing, and git diff checks run locally. Unit coverage added for lead-time subtraction across midnight and offset-equivalent timestamps, invalid/missing start values, and elapsed trigger times. Full Android compilation and JVM test execution require the Gradle distribution, which this environment cannot download.

On a phone: save a future event; select each lead time; verify permission grant/denial/settings flows, replacement and removal, removal from Details, process termination, reboot, and notification tap. Temporarily use a near-future event to verify delivery without waiting hours. Check Android 12 and 13+, channel disabled, both themes and enlarged fonts. Open directions with a default map app, multiple map apps, no map app, and missing venue coordinates.
