# Hyena App Backend

Node.js and Express REST API backed by PostgreSQL hosted on Aiven.

## Requirements

- Node.js and npm
- Access to the Aiven PostgreSQL database
- The Aiven CA certificate

## Local setup

From the repository root:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Copy the example file only when creating a new `.env`. Do not overwrite an existing configured file.

Fill `.env` with your actual database connection settings:

```dotenv
PORT=4010
NODE_ENV=development
DB_HOST=your-aiven-host
DB_PORT=your-aiven-port
DB_NAME=defaultdb
DB_USER=your-database-user
DB_PASSWORD="your-database-password"
DB_SSL_CA_PATH=./certs/ca.pem
CURATOR_API_KEY=your-generated-development-key
```

Save the downloaded Aiven CA certificate as `backend/certs/ca.pem`.

Generate a development curator key with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep actual credentials in the ignored `.env` file. Do not put the curator key in the Android app.

## Run locally

From `backend`:

```powershell
npm start
```

The default local address is `http://localhost:4010`.

The backend verifies Aiven's database certificate using the configured CA file.

## Database files

| File | Purpose |
| --- | --- |
| `db/migrations/initial_schema.sql` | Creates the initial tables, constraints, and indexes |
| `db/seeds/sample_data.sql` | Loads fictional development fixtures |
| `db/tests/constraints_test.sql` | Tests database constraints and rolls back its changes |

On a new database, execute the schema first, then the seed.

The initial schema is not rerunnable against existing tables. The seed uses stable IDs and can be rerun, but it overwrites seed-owned values and refreshes relative dates and session fixtures.

Run the constraint tests after loading the seed. Execute them as a complete script. If execution fails, run `ROLLBACK;` before continuing.

These SQL files are currently executed manually, for example through DBeaver. There is no automated migration runner yet.

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Check API process health |
| GET | `/health/db` | Check database connectivity |
| GET | `/api/v1/experiences` | Retrieve up to 20 active listings with unexpired occurrences today |
| GET | `/api/v1/experiences?q=music` | Search eligible listings before applying the result limit |
| GET | `/api/v1/experiences/:id` | Retrieve one active listing with venue, category, and schedule details |
| GET | `/api/v1/categories` | Retrieve categories |
| GET | `/api/v1/areas` | Retrieve active discovery areas |

Experience retrieval excludes inactive experiences, businesses, and areas.

Search matches titles, descriptions, business names, offer text, and category names. The response count is the number returned, not the total number of matches.

### Date windows and filters

| Parameter | Supported behavior |
| --- | --- |
| `window` | `today` (default), `tonight`, `now`, `date`, or `all` |
| `date` | Required with `window=date`; valid `YYYY-MM-DD` calendar date |
| `q` | Optional keyword string, at most 100 characters |
| `areaId` | Optional UUID of an active discovery area |
| `categoryId` | Optional UUID of an existing category |
| `limit` | Integer from 1 to 100, default 20 |

Today and Tonight use the optional `timeZone` query parameter (the Android app sends the phone’s IANA zone); older API callers that omit it retain venue-local windows. Today spans the local calendar day; Tonight spans 17:00 to the next midnight. Both omit occurrences that have already ended. Now includes only occurrences already started and not ended. All interval endpoints are half-open: an event ending exactly at the filter's start is excluded.

Examples:

```text
http://localhost:4010/api/v1/experiences?window=today
http://localhost:4010/api/v1/experiences?window=tonight&q=music
http://localhost:4010/api/v1/experiences?window=now
http://localhost:4010/api/v1/experiences?window=date&date=2026-11-01
http://localhost:4010/api/v1/experiences?window=all&limit=100
```

Selected-date searches can include historical occurrences, marked `EXPIRED`. All dates explicitly browses active listings regardless of schedule expiry and returns a representative dated occurrence when resolvable (the next unexpired weekly occurrence, otherwise a historical/first occurrence). It is useful when testing old seed fixtures. The Android Home and Explore screens provide Today, Tonight, Now, and All dates chips; Home and Explore also provide shared category, price, and selected-date controls. Area selection is available as a fallback to Near me.

Time-filtered items retain the existing flat listing fields and add `nextOccurrence` containing `startsAt`, `endsAt`, `timeZone`, `localDate`, and `status` (`UPCOMING`, `ONGOING`, or `EXPIRED`). UTC timestamps are formatted in the phone’s zone on Android, including the end date for overnight events. A recurring listing appears once, with its earliest matching occurrence.

Weekly effective dates constrain occurrence start dates, including overnight events that end the following morning. Daylight-saving gaps shift nonexistent times forward by the gap duration. Repeated times use the earlier start and later end. Nonpositive resolved intervals are omitted; malformed schedules are skipped and their listing IDs logged for curator correction. Time-zone handling uses `@js-temporal/polyfill`.

Search and area/category filters are applied in SQL, then recurrence is evaluated before the result limit. Time-filtered results sort by occurrence start and ID. All dates sorts by title and ID. Responses include `count` (returned items), `hasMore` (additional matching items exist), `window`, and `evaluatedAt`. Cursor pagination is not implemented; supplying `cursor` returns 400 rather than silently repeating the first page.

The current implementation evaluates SQL candidates in memory for the curated prototype. Larger datasets will need indexed occurrence queries or a materialized occurrence strategy; `limit` bounds the response, not the number of candidates evaluated. No arbitrary client clock override is exposed.

## Curator endpoints

All curator endpoints require:

```text
Authorization: Bearer <CURATOR_API_KEY>
```

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/curator/health` | Verify curator access |
| POST | `/api/v1/curator/experiences` | Create a listing, schedule, weekdays, and category links |
| PATCH | `/api/v1/curator/experiences/:id` | Update title, description, offer text, or restrictions |
| PATCH | `/api/v1/curator/experiences/:id/deactivate` | Unpublish a listing while preserving its records |

Creation validates input and saves related records in one transaction.

Updates change only supplied fields. Explicit null values can clear optional offer text and restrictions. Editing an inactive listing does not republish it.

The curator key is a development access mechanism. Use localhost for local key-bearing tests and HTTPS for deployment. User login and account-role authorization are not implemented yet.

## Project structure

| Path | Responsibility |
| --- | --- |
| `server.js` | Express setup and route registration |
| `db.js` | PostgreSQL connection pool and certificate verification |
| `routes/` | Public and curator request handlers |
| `middleware/requireCurator.js` | Development curator access check |
| `validation/experience.js` | Creation and update request validation |
| `validation/discovery.js` | Search, window, date, area/category ID, and limit validation |
| `services/discovery.js` | SQL candidate selection and discovery orchestration |
| `services/recurrence.js` | Time-zone-aware occurrence generation and filtering |
| `tests/` | Automated recurrence, HTTP, and PostgreSQL integration tests |
| `db/` | Schema, seed data, and database tests |

## Android development connection

A physical phone on the same network uses the computer's Wi-Fi IPv4 address and API port, for example:

```text
http://192.168.1.25:4010/
```

The phone cannot reach the computer's API through its own localhost address. Keep the backend running and update the Android API base URL if the computer's address changes.

Local HTTP access is enabled through the Android debug manifest.

## Files excluded from Git

- `.env` and local environment overrides
- `certs/`
- `node_modules/`

Commit `.env.example`, `package.json`, and `package-lock.json`.

## Automated verification

From `backend`:

```powershell
npm ci
npm test
```

Tests use Node's test runner and an isolated PGlite PostgreSQL engine with the checked-in schema. They require no Aiven credentials, do not read your local `.env`, and do not change your live database. PGlite is a development dependency. Fixtures use an injected clock to test exact boundaries, weekly schedules, overnight events, DST gaps/overlaps, SQL filters, validation errors, result limiting, and existing detail responses.

Android formatting tests are in `app/src/test`; run `./gradlew :app:testDebugUnitTest` (or `gradlew.bat :app:testDebugUnitTest` on Windows) in an environment with the required JDK and Android SDK. Also verify time-window chips, search, loading/errors, and Details navigation on a device.

## Updating this branch locally

After pulling changes, run `npm ci` in `backend` and restart the API. Sync Gradle and run Android Studio's debug build. Check the Wi-Fi IP in `ApiClient.kt` if the phone cannot reach the backend. Empty Today/Now results can be legitimate; use All dates to distinguish unavailable schedules from connectivity errors. Existing SQL tables need no migration for this change.

### Android area selection

Home and Explore load active areas from `GET /api/v1/areas`. Selecting an area sends its `areaId` with the existing search and time-window filters. The selection is shared across both tabs and restored across activity recreation. All areas omits `areaId`. If an area is no longer active when the list reloads, selection resets to All areas. This is manual area selection; GPS is not required.

After pulling, sync and build in Android Studio. Select an area on Home, switch to Explore, and confirm it stays selected. Try search and each time window, then All areas. Also check Retry areas with the API temporarily stopped. Android build verification remains pending because this environment cannot download Gradle.

### Near me and viewer-local times

Tap **Near me** to request foreground location permission; approximate permission is supported. The app obtains a one-time fix, defaults to 10 miles, and offers 5/10/25-mile radii. Refresh location after moving. Permission denial, disabled providers, failure, or timeout keeps manual area selection available. Location is held in memory and cleared on activity recreation, not stored in preferences or the database. No background location permission or tracking is used. The API receives coordinates for filtering; production request/proxy logs should avoid recording coordinate query strings.

Additional query parameters:

| Parameter | Meaning |
| --- | --- |
| `timeZone` | Optional IANA viewer zone; Android sends the phone zone and refreshes it on resume. Invalid zones return 400. |
| `latitude`, `longitude` | Supply both; numeric bounds −90…90 and −180…180. |
| `radiusMiles` | Defaults to 10 when coordinates are supplied; range 1…100. Coordinates are required. |

Proximity and `areaId` are mutually exclusive. Search, category, distance, activity flags, and occurrence matching are combined before the result limit. Distance is great-circle distance from the supplied position to each business, returned as `distanceMiles`. Venues lacking coordinates are excluded from Near me but remain accessible through manual browsing. No geocoding or area-center substitution occurs. Existing chronological ordering is retained. The implementation evaluates candidates in memory and is suitable for this curated prototype; indexing/PostGIS is a future scaling step.

Schedule rules and DST resolution remain in the venue zone. Only the filter boundaries use the viewer zone; the service translates those boundaries back to venue dates before checking recurrence and overnight starts. Now remains invariant across zones. Android formats occurrence instants, dates, and overnight end dates in the phone zone, labeled with its zone ID. All dates uses a representative dated occurrence, including historical ones; it does not convert a recurring wall time without a date.

After pulling: restart `npm start`, sync Gradle, then run on the phone. Test granting approximate/precise permission, denying permission, disabling location, choosing fallback areas, changing radii, switching tabs, and changing the phone time zone. Near me can legitimately be empty because the seed venues are fictional coordinates. For emulator tests, set a position near a seeded venue (Rexburg: 43.8231, −111.7924). No SQL migration or reseeding is required.

### Category, price, and date filters

Home and Explore share search, category, applied price/currency, and date-window selections across tabs and activity recreation. Categories load from `/api/v1/categories` with loading/error/retry states. Selecting a date uses a calendar dialog; Cancel leaves the current window unchanged. Its UTC calendar representation is converted directly to an ISO date, avoiding a one-day shift on phones west of UTC. The API interprets that date in the supplied viewer time zone. Past dates may intentionally return historical occurrences.

Price parameters combine with existing search/category/area/proximity/time filters:

| Parameter | Values and rules |
| --- | --- |
| `categoryId` | Existing category UUID; omitted for All categories. |
| `price` | `any` (default), `free`, or `max`. |
| `maxPrice` | Required with `price=max`; decimal 0–99999999.99 with up to two decimal places. Inclusive upper bound. |
| `currency` | Required with `price=max`; three uppercase letters. No conversion between currencies. |

`free` requires numeric `price_amount = 0`, regardless of currency. Labels such as “Free entry” without a numeric zero are not inferred to be free. `any` includes listings with unknown prices; `free`/`max` exclude them. Maximum price compares only listings in the specified currency using PostgreSQL numeric arithmetic, before result limiting. Supplying maxPrice/currency outside max mode, malformed amounts, or an invalid mode returns a structured 400 response.

The app offers USD/CAD/EUR/GBP, defaults to USD and an initial maximum of 25.00 when Maximum price is selected, and applies edited amounts only after **Apply maximum**. Invalid drafts stay on screen with a validation message and do not replace the applied filter. **Clear filters** restores empty search, All categories, Any price, Today, All areas, and a 10-mile radius; it also clears the captured location and cancels an in-progress location request.

Example API requests:

```text
/api/v1/experiences?price=free&window=tonight&timeZone=America%2FDenver
/api/v1/experiences?price=max&maxPrice=20.00&currency=USD&window=date&date=2026-10-28&timeZone=America%2FDenver
```

Validation: `npm test` covers price boundaries, zero/unknown prices, currencies, invalid parameters, and combined category/search/location/date/price filters. After pulling, restart the API, sync Gradle, and test on a device: select a category and Free, then Maximum price; enter invalid text and verify it does not apply; choose and cancel a date; switch tabs; Clear filters; and retry categories while the API is unavailable. Android builds/tests still require the local Android Studio environment because Gradle downloads are blocked here.
