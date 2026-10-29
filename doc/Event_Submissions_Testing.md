# Event submissions and administrator review

This feature is on **feature/event-submissions**. It is not merged into master, deployed to the production Render service, or applied to Aiven automatically. The existing live discovery service remains unchanged.

## What is implemented

- Android **+ Event** opens a one-time event form on Home/Explore.
- The form loads categories, active areas, and searchable active venues; users may propose a new venue instead.
- Event data includes title, description, category, USD price or unknown price, offer, requirements, date, start/end times, overnight flag, and venue time zone.
- **Submit for review** creates a pending record and displays its reference. It does not publish anything.
- A private dashboard at **/admin/** provides administrator sign-in, Pending/Approved/Rejected queues, review details, approval, rejection reasons, and pagination.
- Approving publishes the experience, schedule, and category links in one transaction. A proposed venue can be created (with optional coordinates) or matched to an existing venue. Missing coordinates mean the venue is excluded from Near me.
- Rejecting keeps the submission out of public discovery. Approved/rejected decisions cannot be reversed by this first version; an existing published experience can still be managed through the curator API.

## 1. Get the feature branch

From the project root in PowerShell:

```powershell
git fetch origin
git switch feature/event-submissions
cd backend
npm ci
```

Do not merge into master until you have tested the form and dashboard. Render currently deploys master, so pushing this branch does not deploy the feature.

## 2. Apply the additive migration

In DBeaver, open **backend/db/migrations/002_event_submissions.sql** on the intended database. Clear any text selection and execute the entire script (Alt+X). It creates event_submissions and admin_sessions plus indexes; it does not modify existing experiences, users, or saved data. It is safe to rerun.

For local tests against a separate development database, apply the original initial_schema.sql first, then the sample fixtures if wanted, then migration 002. Do not recreate existing tables on your working Aiven database.

A setup check:

```sql
SELECT to_regclass('public.event_submissions'), to_regclass('public.admin_sessions');
```

Both results should name their tables.

## 3. Configure administrator sign-in privately

In the backend terminal:

```powershell
node scripts/create-admin-password.js
```

Enter a new password of 12–256 characters. Input is hidden. The script prints a scrypt hash, not the password. In your ignored **backend/.env**, add:

```dotenv
ADMIN_USERNAME=your-admin-name
ADMIN_PASSWORD_HASH=paste-the-generated-scrypt-hash
```

Keep the hash and password private. The hash starts with scrypt: and is not a curator key. Do not put either credential in Git, Gradle properties, or Android code. The existing CURATOR_API_KEY remains required for the separate curator API and is never sent to dashboard JavaScript.

Start or restart:

```powershell
npm start
```

Visit **http://localhost:4010/admin/** and sign in. Without the optional admin configuration the dashboard API returns 503 and remains locked; discovery still works.

## 4. Connect the test Android build to this backend

The app normally defaults to the deployed master API, which does not yet contain these endpoints. For this feature test, set HYENA_API_BASE_URL in your local Gradle properties to the computer's actual LAN address, with a trailing slash:

```properties
HYENA_API_BASE_URL=http://YOUR-PC-LAN-IP:4010/
```

On Windows the private user-level file is **%USERPROFILE%\.gradle\gradle.properties**. Replace the placeholder with your computer's current IPv4 address (ipconfig). Your phone must be on the same network; localhost on the phone refers to the phone. Keep the existing debug cleartext-network configuration; use HTTPS for hosted/release builds.

Sync Gradle, rebuild, and run. Tap **+ Event**, choose a category, area, and venue, and enter a future one-time event. The date and times belong to the venue, not the phone. Price 0 means Free; Price unknown is deliberately excluded by Free/Maximum price filters.

## 5. End-to-end acceptance test

1. Submit an event titled uniquely enough to search for later. Confirm the reference appears.
2. Search for it in Explore under All dates: it must not appear while pending.
3. In the dashboard, refresh Pending and select it. Verify the venue, schedule zone, price, category, and requirements.
4. Choose **Approve & publish**. The entry moves to Approved and provides a link to its published API details.
5. Refresh Explore with matching location/category/date/price filters. The event should now be visible. Home shows it only if it is unended today in the viewer's zone and fits the first 12 results.
6. Submit another event and reject it with a reason. Verify it is absent from discovery and present in Rejected.
7. Test a proposed venue, then match one proposal to an existing venue to avoid creating a duplicate business.
8. Test unknown price, free price, overnight events, missing fields, an expired date, invalid times, connection failure, retry without editing, sign-out, and a refreshed dashboard session.

The Android form keeps a client request UUID for identical retries. If a response is lost, retry without editing. Editing starts a new request identity; submitting the same event again as a new form may create another pending request for review. Approval locks the pending row and repeated approval returns the same published experience rather than duplicating it.

## Review and security behavior

The browser signs in with the administrator password and receives an eight-hour HttpOnly, SameSite=Strict session cookie. Hosted production cookies are Secure and production administrator requests require HTTPS. Only hashed session tokens are stored in PostgreSQL; password hashes stay in environment configuration. Password rotation invalidates prior sessions.

Mutating administrator requests require the same Origin, JSON, a session, and a CSRF token. Dashboard content is inserted as text, not interpreted as submitted HTML, with a restrictive Content Security Policy. Logout revokes the session. Sign-in is limited to five attempts per IP per fifteen minutes; public submissions to ten requests per IP per hour. These limits are process-local for the current single-instance prototype; scaling requires a shared limiter store and stronger abuse controls.

Public submission validates its references and unexpired venue-local schedule. Approval rechecks those requirements; a venue deactivated, category deleted, or event ended during the wait cannot be published without a new submission or curator correction. Rejected notes and pending payloads are private to the review dashboard. This first version has no submitter sign-in, notification email, public status lookup, image upload, weekly submission, or edit/resubmit workflow. The receipt reference is shown to the submitter.

## API summary

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | /api/v1/businesses?areaId=UUID&q=text | Public; first 50 active matches, refine search when hasMore=true |
| POST | /api/v1/submissions | Public; JSON request with clientRequestId, venue, and event |
| POST | /admin/api/login | Username/password, same Origin and JSON |
| GET | /admin/api/session | Administrator session; returns CSRF token |
| POST | /admin/api/logout | Session, same Origin, JSON, CSRF |
| GET | /admin/api/submissions?status=PENDING | Session; optional before cursor for another page |
| POST | /admin/api/submissions/:id/approve | Session, same Origin, JSON, CSRF |
| POST | /admin/api/submissions/:id/reject | Session, same Origin, JSON, CSRF; note required |

An example public request (replace reference UUIDs with real values):

```json
{
  "clientRequestId": "2824efb4-a0c1-4d87-9b9e-c8f6efab70f6",
  "venue": { "businessId": "YOUR-BUSINESS-UUID" },
  "event": {
    "title": "Neighborhood art evening",
    "description": "A community workshop with shared materials.",
    "type": "EVENT",
    "categoryIds": ["YOUR-CATEGORY-UUID"],
    "priceAmount": "5.00",
    "currency": "USD",
    "schedule": {
      "kind": "ONCE",
      "startDate": "2030-05-10",
      "endDate": "2030-05-10",
      "startTime": "18:00",
      "endTime": "20:00",
      "endsNextDay": false,
      "timeZone": "America/Denver",
      "weekdays": []
    }
  }
}
```

For a proposed venue, replace venue with `{ "proposal": { "areaId": "AREA-UUID", "name": "Workshop Room", "address": "10 Main St", "city": "Rexburg" } }`. Approval may supply businessId to match it to an existing business; otherwise it creates the proposed venue with optional latitude/longitude supplied together. Rejecting uses `{ "note": "Reason for rejection" }`.

## Later production rollout

After testing: apply migration 002 to the deployed Aiven database, configure ADMIN_USERNAME and ADMIN_PASSWORD_HASH privately in Render, merge the feature into master, and let Render redeploy. Never automatically publish pending submissions as a deployment step. Remove the LAN Gradle override and rebuild Android against the hosted HTTPS API. Verify /admin/ sign-in and one controlled submission/review before sharing the form.

No production database, Render credentials, or live submissions were touched while building this feature.

## Verification limits

Backend tests run against an isolated PostgreSQL-compatible PGlite instance using the actual migrations. Tests cover publication, rejection, rollback, retries, private queues, credentials, cookies, CSRF, origins, pagination, rate limits, and the existing curator publisher. Concurrent reviews are tested through a serialized pool adapter; full multi-connection PostgreSQL load testing remains future work.

Android DTO serialization contract tests were added, but Gradle download access in this environment prevents running the Android build/tests. Browser automation could not initialize because of its environment's read-only session directory, so visual dashboard interactions also need your later browser check. Dashboard assets and authenticated HTTP endpoints are covered by automated server tests; JavaScript syntax is checked separately.
