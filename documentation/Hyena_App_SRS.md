# Hyena App Software Requirements Specification

Version 0.1  |  Draft for project review  |  October 3, 2026

This SRS defines the first release of Hyena App, an Android application for finding nearby food deals, local events, and other time-sensitive experiences happening today or tonight. It sets the MVP boundary and gives the team testable requirements for the Android app and proposed service. The current repository baseline remains a working Android starter screen; the discovery features and backend below are requirements, not claims of completed implementation.

| Document item | Value |
| --- | --- |
| Product | Hyena App |
| Document status | Draft 0.1 for team review |
| Primary client | Android application |
| Backend direction | REST API with Node.js/Express and PostgreSQL; proposed |
| Project timing | Project Week 1 corresponds to course Week 3 |

## 1 Introduction

### 1.1 Purpose

This document states what Hyena App must do for its initial student project release and how the team can verify those behaviors. It is the requirements baseline for the Android foundation and database work that follow. Architecture and implementation detail belong in the companion Software Design Description.

### 1.2 Product scope

Hyena App helps a person discover curated nearby experiences, with emphasis on food specials, promotions, and local activities that are available today or tonight. A user selects a discovery area, browses or searches listings, narrows results, opens details, and may save experiences to an account. The MVP uses curated records maintained by the project team; it does not accept public listing submissions.

The MVP includes area-based discovery, a browsable experience feed, experience details, keyword search, category and date/time filtering, weekly recurring schedules, saved experiences for signed-in users, and optional account access. Map presentation and Surprise Me are planned product features and are retained as MVP candidates; their release priority remains subject to the team’s scope decision. Build My Night is a stretch feature and is outside the MVP.

### 1.3 Intended audience

The intended readers are the Hyena App project team, course reviewers, and anyone implementing or testing the Android client, API, or database. Requirement IDs should be used in design notes, issues, and test cases.

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Experience | A time-bounded event, promotion, special, or activity associated with a business or venue. |
| Occurrence | One dated instance of an experience, calculated from its schedule and local time zone. |
| Discovery area | The city, postal code, or other named area selected by the user to find nearby listings. |
| Curated data | Listing information entered or maintained by the project team rather than submitted by the public. |
| MVP | The smallest release that supports the core discovery and saved-experience workflow. |

## 2 Overall description

### 2.1 Product perspective

Hyena App is a new Android client. The existing repository was reviewed earlier on October 3, 2026 and contained the Android starter experience rather than the discovery product. Prior setup notes identify Kotlin, Jetpack Compose, and Material 3 as the client direction. A REST service and PostgreSQL database are proposed but have not been verified as implemented. The exact hosting provider, map provider, and curated-data workflow remain open decisions.

### 2.2 User classes

| User class | Needs |
| --- | --- |
| Visitor | Browse, search, filter, and view experiences without creating an account. |
| Registered user | Use visitor features and save or remove experiences associated with their account. |
| Project curator | Prepare and maintain experience, business, category, and recurrence records through the team’s chosen data-entry process. A curator-facing admin UI is not required for MVP. |

### 2.3 Operating environment

The client targets Android phones. The project’s earlier setup used a minimum Android API level of 28 and Jetpack Compose; the team should recheck the repository configuration before implementation. The proposed service is accessed over HTTPS and stores shared listing and account data in PostgreSQL. Browsing should not require GPS permission; the user-selected area is the MVP location input.

### 2.4 Constraints and dependencies

- Experience listings must be curated and available from the service or a documented seed dataset.

- Authentication is optional for browsing; account access is required to sync saved experiences across sessions and devices.

- Recurring weekly schedules require an IANA time-zone identifier so displayed dates and times reflect the venue’s local time.

- Map rendering depends on selecting a provider and confirming key, billing, and attribution requirements. Until then, map behavior is a candidate requirement.

- No external event, restaurant, payment, ticketing, or reservation integration is confirmed for the MVP.

### 2.5 Out of scope

Public user-submitted listings, payments, ticket purchases, reservations, social feeds, messaging, reviews, push notifications, algorithmic personalization, and Build My Night are outside this MVP. These may be reconsidered after the core discovery flow is working.

## 3 User workflows

- First visit: the user chooses a discovery area and lands on a feed of upcoming experiences relevant to that area.

- Discovery: the user selects Today or Tonight, applies category or keyword filters, and scans matching listings.

- Details: the user opens an experience to see its title, business, description, venue, date/time, price or offer details when provided, and source/contact information when available.

- Saving: a visitor who chooses to save an item is asked to sign in or create an account; a registered user can save or remove it and view saved items later.

- Recurring event: the system calculates dated occurrences from a weekly schedule in the venue’s local time zone and includes the correct occurrence in date-based discovery.

## 4 Functional requirements

Unless a row says Candidate, the requirement is in the proposed MVP. “Shall” indicates required behavior. Priorities use Must, Should, and Candidate.

| ID | Priority | Requirement | Acceptance check |
| --- | --- | --- | --- |
| FR-01 | Must | Browse without account | The app shall allow a visitor to browse experience listings and view their details without registering or signing in. A fresh install can reach the discovery feed without an account prompt. |
| FR-02 | Must | Choose discovery area | The app shall let a user choose and change a named discovery area using a supported text input such as city or postal code. The selected area is visible and changing it refreshes the result set. |
| FR-03 | Must | View discovery feed | The app shall show experiences matching the selected area, ordered by the next upcoming occurrence. A seeded listing with a future occurrence appears in the feed; an expired occurrence does not. |
| FR-04 | Must | Today and tonight views | The app shall provide date/time views for experiences available today and tonight in the experience’s local time zone. A listing appears in the correct view based on its local occurrence window. |
| FR-05 | Must | View experience details | The app shall display the experience title, business or venue, description, location, schedule, and any available offer details. Tapping a listing opens a detail view with its stored fields; absent optional data is not shown as invented content. |
| FR-06 | Must | Search listings | The app shall allow keyword search across experience title, description, business name, and category. A matching query returns the seeded matching record; a nonmatching query shows an empty state. |
| FR-07 | Must | Filter listings | The app shall filter listings by category and selected date/time view. Selecting a category and Today returns only records matching both filters. |
| FR-08 | Must | Represent recurring schedules | The system shall store weekly recurrence day(s), local start and end time, effective start date, optional end date, and IANA time-zone identifier. A recurring test record generates the expected local dates across a daylight-saving transition. |
| FR-09 | Must | Save experience | A registered user shall be able to save and unsave an experience. The saved state updates and remains after closing and reopening the app. |
| FR-10 | Must | View saved experiences | A registered user shall be able to view their saved experiences. The saved list contains only experiences saved by the authenticated user. |
| FR-11 | Must | Optional account access | The app shall support account registration, sign-in, and sign-out for users who want saved experiences synced to an account. A new account can sign in, sign out, and sign in again; browsing remains available while signed out. |
| FR-12 | Must | Separate user data | The service shall associate saved experiences with the authenticated user and prevent one user from reading or changing another user’s saved list. API tests with two accounts show isolated saved lists and reject cross-account mutations. |
| FR-13 | Must | Show useful empty and error states | The app shall explain when no experiences match and provide a retry action when listing retrieval fails. Empty results and simulated service failure produce distinct, actionable states. |
| FR-14 | Should | Map view | The app should show eligible experiences on a map and let the user open a listing from a map marker. When a map provider is configured, a seeded venue marker opens its matching detail view. |
| FR-15 | Candidate | Surprise Me | The app may offer a Surprise Me action that selects one eligible experience from the current area and active filters. Repeated actions return valid matching listings when at least one result exists and a clear empty state otherwise. |
| FR-16 | Must | Curated listing data | The MVP shall obtain business, experience, category, and recurrence data from project-curated records. The release dataset can be loaded through the team’s documented seed or maintenance process. |

## 5 External interface requirements

### 5.1 User interface

The Android client shall use a consistent navigation structure with clear destinations for discovery and saved experiences. A first-run area selection must lead into discovery. List cards must expose enough information to distinguish experiences, and each card must open an accessible detail screen. Loading, empty, and error states must be visible and understandable.

### 5.2 Service interface

The planned service uses a versioned HTTPS REST API with JSON request and response bodies. The precise endpoints and schemas are an SDD/API design decision. At minimum, the API must support experience discovery and detail retrieval, categories, recurrence data, account access, and authenticated saved-experience operations.

### 5.3 Data model concepts

The initial relational model shall include the following entities. Exact columns, keys, indexes, and migration strategy belong in the SDD and database scripts.

| Entity | Purpose | Key relationships |
| --- | --- | --- |
| Business | Venue or organization associated with listings. | One business may have many experiences. |
| Experience | Discoverable event, special, or promotion. | Belongs to a business; has one or more categories and schedule data. |
| Category | Classification used for browsing and filtering. | Many-to-many with experiences if an experience can have multiple categories. |
| User | Registered account used for saved items. | One user may save many experiences. |
| SavedExperience | Join record for a user’s saved listing. | References one user and one experience; unique per pair. |
| Schedule / recurrence | Weekly local schedule and effective date range. | Belongs to an experience and includes a time-zone identifier. |

### 5.4 Location and map interface

The user-selected area is the source of the discovery location for MVP. The app shall not request precise device location unless a later approved requirement adds it. If map view is included, the selected provider’s usage, attribution, and key-management rules must be documented before release.

## 6 Nonfunctional requirements

| ID | Quality | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Under a normal mobile connection, the discovery screen should display cached or retrieved results within 3 seconds for a result set of up to 100 records. API response time target is p95 under 2 seconds for standard discovery queries. |
| NFR-02 | Security | All service traffic shall use HTTPS. Passwords shall be stored only as salted, adaptive hashes. Authenticated endpoints shall authorize every saved-experience operation against the signed-in user. |
| NFR-03 | Privacy | The MVP shall not collect precise GPS coordinates. Account fields shall be limited to what sign-in and saved-item ownership require; the team must document retention and deletion behavior before collecting real user data. |
| NFR-04 | Usability | Primary discovery, detail, and save actions shall be reachable through the app’s visible navigation and controls without requiring gestures alone. |
| NFR-05 | Accessibility | Interactive controls shall have accessible labels, support Android font scaling, and provide touch targets of approximately 48 dp where practical. Text and control contrast shall be checked before release. |
| NFR-06 | Compatibility | The Android app shall support the project’s agreed minimum API level. Prior setup used API 28; the team shall verify this against the current repository and test on at least one emulator or device at the minimum supported level. |
| NFR-07 | Time correctness | Occurrence generation and display shall use the venue’s IANA time zone. A weekly occurrence shall retain its intended local wall-clock time when daylight-saving offsets change. |
| NFR-08 | Data integrity | Database constraints shall prevent duplicate saved pairs and invalid references. Experiences and businesses referenced by saved records shall not be hard-deleted without an explicit retention rule. |
| NFR-09 | Reliability | A service error shall not crash the app. The client shall present retry behavior and preserve the selected area and filters when feasible. |
| NFR-10 | Maintainability | The Android client, API, and database schema shall be organized so UI, service, and persistence responsibilities can be changed independently. API and schema decisions shall be documented in the SDD. |

## 7 Data and business rules

- Each experience is associated with at least one business or venue and at least one category unless the team explicitly documents an exception.

- A recurring schedule is interpreted in the venue’s local time zone; the server stores the IANA zone name rather than relying on the phone’s current zone.

- Today and Tonight are evaluated from the relevant experience occurrence in local time. The team must define the exact evening cutoff before implementation; a proposed default is 5:00 p.m. through 11:59 p.m. local time.

- An experience with an end date earlier than the current occurrence is excluded from current discovery results.

- Saved records are unique by user and experience. Removing a saved item does not delete the experience itself.

## 8 Acceptance and release criteria

The MVP is ready for a project demonstration when all Must requirements have passing tests or documented manual checks, the seed dataset supports each core workflow, and the Android app can retrieve and display discovery results from the agreed service or a documented development substitute.

- A signed-out visitor can select an area, browse, search, filter, and open an experience.

- A recurring weekly listing appears on the correct local dates and keeps its local start time over a daylight-saving change.

- A user can create an account, sign in, save and unsave an experience, and see only their own saved records.

- Empty results, loading, and service failure are represented without crashing.

- The team has recorded the map and Surprise Me scope decision, the exact Tonight cutoff, and the selected backend and map provider.

## 9 Assumptions and open decisions

| Decision | Current position | Needed before |
| --- | --- | --- |
| Backend framework | Node.js/Express is proposed; not verified as implemented. | SDD and API implementation |
| Database hosting | PostgreSQL is planned; host is undecided. | Database setup |
| Map provider | Undecided; map feature remains a candidate requirement. | Map implementation |
| Tonight cutoff | Proposed 5:00 p.m.–11:59 p.m. in venue local time. | Date/time filter implementation |
| Authentication method | Optional account for saving; provider and verification flow are undecided. | Account implementation |
| Discovery radius | The user selects a named area; exact area lookup/geocoding approach is undecided. | Area selection implementation |
| Curated data maintenance | Team-managed seed or direct database maintenance; no admin UI in MVP. | Database and demonstration dataset |

## 10 Milestones and traceability

The project’s first three weeks correspond to course Weeks 3 through 5. This SRS establishes the Week 1 requirements baseline. The following milestones use that baseline; they do not imply those tasks are already complete.

| Project week | Course week | Milestone | SRS output used |
| --- | --- | --- | --- |
| Week 1 | Week 3 | Requirements and planning | Approve MVP boundary, requirement priorities, and architecture direction. |
| Week 2 | Week 4 | Android application foundation | Build navigation and screen structure for FR-01 through FR-07 and FR-13. |
| Week 3 | Week 5 | Database design | Design PostgreSQL entities and constraints for FR-08 through FR-12 and FR-16; document recurrence rules. |

Next deliverable: the Software Design Description should turn the approved requirements into Android screen/navigation design, API contracts, PostgreSQL tables and constraints, and a recurrence-generation approach.

## 11 Source notes

This draft uses the project context recovered on October 3, 2026: the Hyena App concept, the prior repository review that found a working Android starter screen, earlier Android setup notes, and the planning decisions summarized in the conversation. Features that were discussed as future ideas are marked Should, Candidate, or out of scope. The team should review and approve proposed thresholds and unresolved choices before treating this draft as a frozen baseline.
