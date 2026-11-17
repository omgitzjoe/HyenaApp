# HyenaApp

Hyena is a location-aware Android app that helps users discover interesting, timely things to do nearby.

It focuses on local events, recurring promotions, limited-time offers, and activities happening **today or tonight**.

## Tech Stack

- Kotlin
- Jetpack Compose
- Material 3
- REST API
- PostgreSQL

Hyena's goal is simple: **help users figure out what to do right now.**

## Lightweight calendar schema

The current field and constraint reference is [`backend/db/schema.sql`](backend/db/schema.sql).
`initial_schema.sql` is the historical bootstrap; existing databases upgrade through
`npm --prefix backend run migrate` (also run at server startup). Do not replay bootstrap
DDL against an existing database.

Migration 006 removes the explicit fictional catalog IDs, user/account tables, and
retired fields. Migration 007 removes two individually verified live test submissions. Cleanup preserves categories, real feed decisions, and referenced venues.
Production seed scripts now add categories only; historical catalogs live in test fixtures.

An event needs a title, scheduled start (or All Day), and a venue. Description, end time,
price, categories, and source link are optional. Type defaults to `OTHER`. Prices use USD;
`0` means Free, while null means no price supplied. Venue locations need city/state or a
coordinate pair. Address lookup uses free Photon/OSM with caching and request throttling;
city-only venues have no precise distance or directions and are excluded from radius results.
Time zones are optional on input and resolve from coordinates, otherwise America/Denver.
ONCE schedules use explicit end dates for overnight and multi-day events. Weekly schedules
infer midnight crossing from their time pair. An unknown end uses local day-end for filtering
and expiration only; Android does not show that as a supplied end time.

Qualified feed events auto-publish and create/reuse venues. Incomplete candidates stay
Pending; source cancellations/notices/holidays are filtered, rejected IDs stay blacklisted,
and Undo prevents automatic reapproval. Source sync runs at startup and hourly while the
Render process is awake. Manually submitted events always enter Pending.

Saved events, reminders, appearance, and search filters stay on the device. Upgrading
preserves preference keys and real saved snapshots while removing known demonstration saves.

## Admin listing management

Pending and Approved entries support category, optional USD price (`0` = Free), venue,
text and schedule edits. Approved edits update the existing event ID atomically. Revisions
prevent saving an outdated editor, and the original request snapshot preserves submission
retry identity after edits. Review notes have been removed; review ownership and Undo remain.

The admin workspace prioritizes community submissions, supports event/venue search and source
filters, and hides past/withdrawn listings unless the archive checkbox is enabled. Public
All dates, historical date searches, and event detail endpoints exclude ended events. Ended
records remain stored for feed identity and review history. Ended one-time local snapshots expire on load; recurring saves and other device preferences are preserved.

Feed preview shows only newly discovered IDs. Internal sync still revisits eligible Pending
entries. Publication checks normalized event titles, occurrence start and venue identity;
clear automatic duplicates are rejected with a link to the canonical event. Different start
times and venues remain separate. Migration 008 also withdraws existing exact duplicates at
the same venue and start, preserving their records and blacklist identities.
