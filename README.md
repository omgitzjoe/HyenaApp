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
retired fields. It preserves categories, real feed decisions, and referenced venues.
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
