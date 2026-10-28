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

Today and Tonight use each venue schedule's named time zone. Today spans the local calendar day; Tonight spans 17:00 to the next midnight. Both omit occurrences that have already ended. Now includes only occurrences already started and not ended. All interval endpoints are half-open: an event ending exactly at the filter's start is excluded.

Examples:

```text
http://localhost:4010/api/v1/experiences?window=today
http://localhost:4010/api/v1/experiences?window=tonight&q=music
http://localhost:4010/api/v1/experiences?window=now
http://localhost:4010/api/v1/experiences?window=date&date=2026-11-01
http://localhost:4010/api/v1/experiences?window=all&limit=100
```

Selected-date searches can include historical occurrences, marked `EXPIRED`. All dates explicitly browses active listings regardless of schedule expiry and returns `nextOccurrence: null`. It is useful when testing old seed fixtures. The Android Home and Explore screens provide Today, Tonight, Now, and All dates chips; selected-date, area, and category parameters are currently API-only controls.

Time-filtered items retain the existing flat listing fields and add `nextOccurrence` containing `startsAt`, `endsAt`, `timeZone`, `localDate`, and `status` (`UPCOMING`, `ONGOING`, or `EXPIRED`). UTC timestamps are formatted in the venue zone on Android, including the end date for overnight events. A recurring listing appears once, with its earliest matching occurrence.

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
