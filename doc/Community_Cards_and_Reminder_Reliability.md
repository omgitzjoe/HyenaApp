# Community cards and reminder reliability

Hyena stays a lightweight communal calendar: no promoted listings, paid rankings, account wall, or donation/payment flow. Discovery ordering is still occurrence time, then distance. Categories never influence ranking.

## Cards and event actions

Discovery now supplies the full category list. Neutral cards have equal colored top segments for their categories and horizontally scrollable, labeled pictograms below the title. Icons are drawn locally, without downloaded assets or another dependency. Food, music, games, family, outdoors, arts, sports, learning, markets, movies, and seasonal events have consistent accents. Unknown categories retain their own label with a community pictogram. Color is supplemental; labels remain readable in either theme. Time is emphasized and price is independently labeled Free, a numeric price/currency, or Price unknown. Existing offer descriptions remain visible. Categories and prices survive saving from a card or Details. Older saved snapshots normalize missing metadata safely; remove/re-save an older snapshot to obtain its current category and price metadata.

Details offers native text sharing with venue, local schedule, price, offer and a maps link, plus an anonymous incorrect-details form. Reports validate event ID, enumerated reason, and 1,000-character maximum, and are rate-limited to five per hour per IP. Reports are stored by additive migration 004 and appear in the authenticated admin dashboard's Community corrections queue. Curators investigate and update through curator tools before resolving. Reports never modify or suppress listings automatically. Resolution requires the existing session, origin and CSRF protections.

## Missed reminder audit

The previous version used inexact alarms, discarded deliveries after the start, and canceled past-due triggers during restoration. Together these could cause silence even with notification permission. The fix uses exact idle alarms when the user grants Alarms & reminders special access, with explicit approximate fallback otherwise. Revoked special access falls back safely. Users are never told timing is precise without the capability check.

Reminder records now preserve occurrence end time. Restoration immediately posts overdue reminders if the occurrence has not ended; blocked notification deliveries remain stored for retry on resume. Legacy records obtain end times from existing saved snapshots on startup. Scheduling persists first and reports failure without pretending success. Delivery removes records only after Android accepts notify(); the diagnostic says Posted to Android, not Seen or Heard. Expired events are not notified. Exact access grants, reboot, app replacement, clock changes and foreground recovery restore pending alarms.

Saved includes notification state, exact-timing state, the scheduled local reminder time, Android settings links, Send test notification now, Test reminder in 1 minute, and refreshable last scheduling/delivery status. Tests use the same channel, pending intent and manifest receiver as real reminders. Force-stop, device vendor restrictions, DND/channel sound configuration and OS throttling can still affect delivery or audibility. This environment has no Android device and cannot download Gradle; delivery on the user's phone is not claimed as verified.

## Validation and phone checks

Backend tests cover category metadata, report validation/rate limits, unchanged listing state, authenticated report retrieval, CSRF-protected resolution and migration repeat safety. JVM price tests and instrumentation tests were added. Instrumentation covers direct posting/cancellation, overdue restoration after event start and actual AlarmManager-to-receiver delivery. Kotlin parsing and XML checks run here; JVM and instrumentation execution require Android Studio.

After updating, open Saved → Enable precise reminders and grant Alarms & reminders. Run the immediate notification test, then the one-minute test with the screen locked. Refresh delivery status if nothing appears and check the Saved event reminders channel and DND. Run connectedDebugAndroidTest with notifications and exact alarm access enabled (delivery tests explicitly skip when access is unavailable). Check a real saved event, replacement, unsave, reboot, both themes, enlarged fonts, category combinations, Share and report submission/admin resolution. The public report endpoint is not exercised with fabricated production submissions during deployment checks.
