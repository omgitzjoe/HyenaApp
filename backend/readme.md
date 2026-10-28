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
node server.js
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
| GET | `/api/v1/experiences` | Retrieve up to 20 active listings |
| GET | `/api/v1/experiences?q=music` | Search eligible listings before applying the result limit |
| GET | `/api/v1/experiences/:id` | Retrieve one active listing with venue, category, and schedule details |
| GET | `/api/v1/categories` | Retrieve categories |
| GET | `/api/v1/areas` | Retrieve active discovery areas |

Experience retrieval excludes inactive experiences, businesses, and areas.

Search matches titles, descriptions, business names, offer text, and category names. The response count is the number returned, not the total number of matches.

Date filtering and recurrence evaluation are not implemented yet. An active listing may still have an expired schedule.

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