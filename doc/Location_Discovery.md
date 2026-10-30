# Location-based discovery — October 29, 2026

This specification replaces named-area selection and the optional Near me workflow.

## Visitor behavior

- Home and Explore automatically request foreground location permission and obtain a fresh position. Approximate permission works; denied/unavailable location shows Retry/App settings rather than global results. There is no area selector or Near me button. Saved snapshots remain accessible offline.
- Location is refreshed when returning to the app and with Home Refresh. No background tracking or location history is added.
- The shared radius is 5, 10 (default), 25, or 100 miles. Distances are approximate straight-line miles, not driving routes.
- Home shows up to twelve ongoing/upcoming experiences today, closest first. Explore combines search, dates/time windows, USD pricing, distance, and multiple category selections. Selected categories use **any selected category** (OR); other filter types combine with AND. All categories clears the category selection.
- Results sort by distance before applying the limit. Equal distances use occurrence start (or title in All dates), then ID, for stable ordering. The many-to-many experience_categories table prevents duplicate links/results.
- Preview cards show distance. Saved cards recompute distance from the latest position when saved coordinates are available; old snapshots without coordinates omit distance.
- Instants remain stored/transmitted accurately. Android formats every dated interval in the phone's current local time and omits zone names. Today/Tonight/selected-date boundaries use that same phone setting. Set the phone's automatic time-zone setting when traveling. Venue schedules still retain internal IANA zones for daylight saving.

## Venue and event submission

Choose a nearby existing venue or propose a new one. A proposed venue has a name, street address, city, latitude, and longitude—no area or editable time zone. Locate address uses Android's geocoder; verify the returned coordinates. If lookup is unavailable, enter coordinates or use the current position when physically at the venue. The server derives its IANA zone using @photostructure/tz-lookup; compressed geographical lookup can be approximate near zone boundaries.

Choose one or more categories. Enter the date and times at the venue. The All Day toggle sits beside Ends next day, disables the time inputs, and submits 00:00–23:59 with endsNextDay=false. Turning it off restores the typed times. The API also normalizes All Day and the database constrains these values. A viewer elsewhere still sees the corresponding converted local interval, which may span two dates.

Approval rechecks venue coordinates and derives the final schedule zone. Reviewers can supply missing coordinates on old queued proposals or unlocated existing venues. Proposed venues may still be matched to an existing located venue. Dashboard schedule previews use the reviewer's browser-local time. Pending/rejected events remain private; retry IDs and atomic review behavior are preserved.

## Database and deployment

`npm start` runs ordered migrations before opening the HTTP server. The runner locks concurrent startups and tracks completion in schema_migrations. Migration 003:

1. Copies legacy venue zone information and inactive-area visibility to each venue.
2. Retires businesses.area_id and discovery_areas without deleting businesses, experiences, categories, users, saves, or submissions.
3. Adds all_day and converts old midnight-to-midnight all-day fixtures to 00:00–23:59.
4. Derives accurate venue/schedule zones from existing coordinates in the migration runner.
5. Removes obsolete area IDs from pending proposed venues. Missing coordinates require review; they are never fabricated from a city centroid.

Unlocated old venues remain stored but are excluded from proximity discovery and venue selection. The original schema is archived solely as tests/fixtures/legacy_schema.sql for upgrade tests. Fresh databases use db/migrations/initial_schema.sql followed by `npm run migrate`. Existing databases must **not** rerun initial_schema.sql.

The checked-in sample_data.sql and refresh_mock_catalog.sql use the new schema, preserve fixture IDs, contain multi-category experiences and All Day schedules, and contain no area table/field. Catalog refresh remains optional and manual; deployment never resets the catalog or users. Full sample_data includes public test accounts/sessions; use refresh_mock_catalog.sql for an existing catalog. Regenerate with `python backend/db/seeds/generate_mock_data.py`; catalog_identities.json preserves stable identities.

## API changes

- GET /api/v1/experiences requires latitude and longitude; radiusMiles defaults to 10. Responses include distanceMiles and venue coordinates. Missing coordinates return LOCATION_REQUIRED; areaId returns AREAS_REMOVED.
- categoryIds accepts a comma-separated set of up to 20 distinct category UUIDs. The former singular categoryId remains supported for older callers, but cannot be combined with categoryIds.
- GET /api/v1/businesses accepts q and optional latitude/longitude together. With coordinates it sorts venues by distance. Coordinate-free access supports private dashboard matching.
- GET /api/v1/areas returns 410 with a migration message.
- POST /api/v1/submissions proposed venues require coordinates. event.schedule.timeZone may be omitted; the server derives and overrides it. allDay defaults to false.

Discovery still evaluates the small curated catalog in memory after SQL search/category/price filtering. Larger-scale spatial indexes/pagination remain future work.

## Acceptance checks

1. Pull master, sync/rebuild/install Android, and retain the hosted HTTPS API URL. No new Render secrets are required. Render's startup applies migration 003.
2. Grant approximate or precise location. Home/Explore load without pressing Near me. Deny it and verify the settings/retry state; Saved still opens.
3. Check that card distances increase down the list, including All dates and a limited Home feed. Move a test location and return/refresh; distances and results should change.
4. Select multiple categories; verify OR behavior and no duplicate experience cards. Combine with Free, a date, and search, then Clear filters.
5. Submit a venue using a resolved address/verified coordinates. There should be no area/zone fields. Select two categories, toggle All Day, submit, approve, and inspect local-time display. Also test overnight with All Day off.
6. Open the same event with different phone time-zone settings; the displayed interval changes but refers to the same UTC instants. Restore automatic phone time zone afterward.
7. Test rejection, retries, missing coordinates, disabled phone location, and an old queued submission.

Backend automated coverage includes fresh schema/seeds, legacy upgrades and reruns, distance-before-limit, antimeridian calculations, category unions, all-day constraints/publication, derived venue zones, private review/authentication, and existing discovery/recurrence behavior. Android compilation/device acceptance must run in Android Studio if the build environment cannot download Gradle; Kotlin syntax parsing is only an additional check, not a replacement for compilation.
