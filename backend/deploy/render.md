# Run Hyena API online with Render and Aiven

The service is deployed at https://hyena-api-np3j.onrender.com/ (reported connected by the project owner). PostgreSQL stays on Aiven. The Android app connects to Render over HTTPS. Your computer is needed for development, not for serving requests once deployment is verified.

## Current discovery update

`npm start` now tracks migrations 002/003 and upgrades existing Aiven data automatically. No new environment variables are required. Do not rerun initial_schema.sql. Rebuild Android from master; older builds with area selectors are no longer compatible with discovery. API smoke tests must include latitude/longitude, for example `/api/v1/experiences?latitude=43.8231&longitude=-111.7924&window=all`. See doc/Location_Discovery.md.

## 1. Refresh the mock catalog

Pull `master`, then run **backend/db/seeds/refresh_mock_catalog.sql** as an entire script in DBeaver against the existing Aiven database. Do not use sample_data.sql for this update: the full file also refreshes public demo accounts and sessions. The catalog-only script is transactional and updates only the known demo catalog IDs. It preserves IDs and does not delete users, sessions, or unrelated listings.

All businesses and offers remain fictional. Re-running refresh_mock_catalog.sql refreshes relative dates; daily weekly listings keep working without daily reseeding, while the explicitly ongoing one-time examples are anchored to the refresh instant. Existing saved phone snapshots keep their old titles until removed and saved again.

## 2. Create the Render service

1. Sign in to [Render](https://dashboard.render.com/).
2. Choose **New → Blueprint**, connect `omgitzjoe/HyenaApp`, and select branch `master`.
3. Render should read the root `render.yaml`: one Node web service, root directory `backend`, build `npm ci --omit=dev`, start `npm start`, and health check `/health/db`.
4. Enter the private environment variables requested by the Blueprint:

| Variable | Value to enter privately |
| --- | --- |
| `DB_HOST` | Aiven PostgreSQL hostname, without a URL scheme |
| `DB_PORT` | Aiven service port |
| `DB_NAME` | Existing database, usually defaultdb |
| `DB_USER` | Aiven database username |
| `DB_PASSWORD` | Aiven database password |
| `DB_SSL_CA` | Complete Aiven CA certificate contents, including BEGIN/END CERTIFICATE lines; multiline or escaped newlines are supported |
| `CURATOR_API_KEY` | A new 64-character hexadecimal key, generated locally |

Generate a hosted curator key locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it directly into Render. Keep it out of Git and the Android app. Do not copy the local PORT or a Windows certificate path into Render. Render supplies PORT; DB_SSL_CA replaces the local file-path setting.

5. Review that the service uses the **Free** compute plan and deploy. The Blueprint pins Node 24.22.1. No Render database or persistent disk is needed.
6. If Aiven IP filtering is enabled, allow the Render service's documented outbound addresses. Keep certificate verification enabled.

If using **New → Web Service** instead, connect the same repository/branch and manually set the same root/build/start/health settings and environment variables. Set NODE_ENV=production and NODE_VERSION=24.22.1.

## 3. Verify the hosted API

Use the HTTPS service URL assigned by Render; do not assume a particular hostname is available. Check:

- `/` — service information and route hints
- `/health` — process is responding
- `/health/db` — Aiven connectivity; must return status ok
- `/api/v1/categories` — populated category list
- `/api/v1/experiences?window=all&limit=5` — realistic mock titles

A successful `/health` alone does not prove database connectivity. If deployment fails, share the error message with credentials removed; keep environment values private.

Free services currently spin down after 15 minutes of inactivity and can take about a minute to wake up. This is suitable for coursework/demo use; an always-awake service requires a paid compute choice. The Android HTTP client permits up to 100 seconds per call to accommodate a cold start, but users may still need Retry after a temporary failure. Nothing in this repo automatically upgrades or purchases a plan.

## 4. Point Android at HTTPS

On your own computer, edit `%USERPROFILE%\.gradle\gradle.properties` and add:

```properties
HYENA_API_BASE_URL=https://YOUR-ACTUAL-SERVICE.onrender.com/
```

Replace the hostname with Render's actual URL and keep the trailing slash. This URL is public configuration, not a database credential. Sync Gradle and rebuild/reinstall the app; it is compiled into BuildConfig. A command-line alternative is `./gradlew :app:assembleDebug -PHYENA_API_BASE_URL=https://YOUR-ACTUAL-SERVICE.onrender.com/`.

Without the property, builds use https://hyena-api-np3j.onrender.com/. For local development, override HYENA_API_BASE_URL with your computer’s LAN URL. Do not distribute a release configured for LAN HTTP; use the deployed HTTPS property when building it. No Aiven password, CA file, or curator key belongs in the Android build.

## 5. Prove independence from your computer

Stop the local Node process, switch the phone off Wi-Fi onto mobile data, and test Home Refresh, categories, Explore, Near me, and Saved. Home/Explore should use Render. Saved snapshots also remain available offline. The app must be rebuilt after changing its base URL; simply restarting the backend cannot change an installed APK.

## References checked October 28, 2026

- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/blueprint-spec
- https://render.com/docs/node-version
- https://render.com/docs/configure-environment-variables
- https://render.com/docs/free

## Event submissions on the existing service

The start command remains `npm start`. It runs the additive migration 002 against the configured Aiven database before opening the API; no DBeaver connection or seed refresh is required. The database user must be allowed to create tables/indexes. A migration failure stops deployment instead of serving partially initialized submission routes.

Run `node scripts/create-admin-password.js` locally in backend. Keep the password private. In the existing Render service Environment page add `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` (the full generated scrypt hash), then save/redeploy. These optional settings are deliberately not added as required Blueprint inputs, so existing discovery can start while administrator setup is pending. Sign in at https://hyena-api-np3j.onrender.com/admin/ with the username and original password. A 503 ADMIN_NOT_CONFIGURED means the private settings still need to be supplied.

Rebuild Android from master using the existing HTTPS URL. Submit an event, verify it is pending and absent from discovery, approve in the dashboard, then find it in Explore. Repeat with a rejected event and confirm it stays private. See doc/Event_Submissions_Testing.md for the full acceptance checks.
