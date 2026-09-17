# HyenaApp --- Product & Technical Blueprint

## 1. Project Overview

### Working Name

**Hyena**

### Product Concept

Hyena is a mobile discovery application that helps people find
interesting, timely, and local things to do.

The application focuses on experiences that are:

-   Available today or tonight
-   Limited-time or recurring
-   Local and location-aware
-   Affordable or price-conscious
-   Unusual, entertaining, or easy to miss
-   Useful for dates, friends, families, college students, or solo
    activities

### Core Question

> **What can I do right now?**

Examples include:

-   Taco Tuesday
-   Trivia night
-   Live music
-   Happy-hour specials
-   Limited-time restaurant promotions
-   Free community events
-   Movie discounts
-   College-night specials
-   Pop-up events
-   Seasonal activities
-   Local festivals
-   Date-night activities

Hyena is not intended to be only a coupon application. Promotions and
offers are the data source, while the main product is helping users
discover experiences.

------------------------------------------------------------------------

## 2. Product Vision

Hyena should make it easy for someone to open an app and immediately see
useful possibilities for the current day or evening.

Instead of requiring users to search through multiple websites,
social-media pages, restaurant pages, and event listings, Hyena should
organize relevant opportunities into one discovery experience.

### Product Statement

> Hyena is a location-aware discovery platform for limited-time
> experiences, local events, recurring promotions, and activities that
> help users decide what to do today.

------------------------------------------------------------------------

## 3. Target Users

The primary target user is someone who:

-   Wants something to do but has no specific plan
-   Wants to discover local activities
-   Cares about price, distance, and time
-   Enjoys trying new experiences
-   Wants date-night or friend-group ideas
-   Wants to find events before they expire
-   Does not want to search multiple platforms manually

### Example User Scenario

A user opens Hyena at 6:30 PM and sees:

-   Taco Tuesday --- \$2 tacos
-   Trivia Night --- starts at 7 PM
-   Live Music --- starts at 8 PM
-   \$5 Movie Tuesday
-   Dessert special --- ends at 9 PM

The user can select an experience, view its details, save it, or get
directions.

------------------------------------------------------------------------

## 4. Core Use Cases

### UC1 --- Discover Today's Experiences

The user opens Hyena and sees experiences relevant to the current day
and time.

### UC2 --- Discover Tonight's Experiences

The user views activities happening during the evening.

### UC3 --- Search

The user searches for terms such as:

-   Pizza
-   Music
-   Trivia
-   Date night
-   Free events
-   Outdoor activities

### UC4 --- Filter

The user filters experiences by:

-   Date
-   Time
-   Distance
-   Price
-   Category
-   Experience type
-   Availability
-   Recurring status

### UC5 --- Surprise Me

The user presses a button that recommends an experience based on
available options and user preferences.

### UC6 --- View Details

The user opens an experience and views:

-   Title
-   Description
-   Business or organizer
-   Date
-   Time
-   Price
-   Address
-   Distance
-   Requirements
-   Expiration
-   Website
-   Directions

### UC7 --- Save an Experience

The user saves an experience for later.

### UC8 --- Explore a Map

The user views available experiences geographically.

### UC9 --- Build a Night

As a stretch feature, the user enters:

-   Budget
-   Available time
-   Preferred category
-   Maximum distance

Hyena creates a possible sequence of activities.

------------------------------------------------------------------------

## 5. Proposed Navigation

The initial bottom navigation should be:

-   Home
-   Explore
-   Map
-   Saved

Settings and profile functionality can initially be accessed from the
Home screen.

### Navigation Flow

``` text
                         HYENA
                           |
                           v
                         HOME
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
          EXPLORE       SURPRISE         MAP
             |             |             |
             +-------------+-------------+
                           |
                           v
                    EXPERIENCE DETAILS
                           |
                    +------+------+
                    |             |
                    v             v
                  SAVE        DIRECTIONS
```

------------------------------------------------------------------------

## 6. Screen Specifications

## 6.1 Home Screen

The Home screen is the most important screen.

### Main Responsibilities

-   Show current and upcoming experiences
-   Emphasize time-sensitive items
-   Provide search
-   Provide category shortcuts
-   Provide access to Surprise Me
-   Display personalized or location-relevant recommendations

### Possible Layout

``` text
Good evening!

What are you looking for?

[ Search experiences... ]

TONIGHT

[ Ending Soon ]
[ Taco Tuesday ]
[ Trivia Night ]
[ Live Music ]

[ Surprise Me ]

Popular Categories

[ Food ] [ Music ] [ Date Night ]
[ Cheap ] [ Games ] [ Family ]
```

### Home Sections

-   Currently happening
-   Starting soon
-   Ending soon
-   Popular nearby
-   Recommended for you
-   Categories
-   Surprise Me

------------------------------------------------------------------------

## 6.2 Explore Screen

### Main Responsibilities

-   Search all experiences
-   Filter results
-   Sort results
-   Browse categories

### Filters

-   Now
-   Tonight
-   Tomorrow
-   This weekend
-   Food
-   Music
-   Games
-   Date night
-   Family
-   Outdoors
-   Free
-   Cheap
-   Distance
-   Price

### Possible Layout

``` text
Explore

[ Search experiences... ]

Categories

[ Food ] [ Music ] [ Games ]
[ Date Night ] [ Cheap ] [ Family ]

When?

[ Now ] [ Tonight ] [ Tomorrow ] [ Weekend ]

Price

[ $ ] [ $$ ] [ $$$ ]

Distance

[ 1 mi ] [ 5 mi ] [ 10 mi ] [ 25 mi ]

Results
```

------------------------------------------------------------------------

## 6.3 Map Screen

### Main Responsibilities

-   Display experiences on a map
-   Allow users to select map markers
-   Show nearby experiences
-   Open experience details

Selecting a marker should display a preview containing:

-   Experience title
-   Business
-   Price
-   Distance
-   Start/end time
-   View Details button

Location functionality can initially use a selected/default area before
device location is implemented.

------------------------------------------------------------------------

## 6.4 Saved Screen

### Main Responsibilities

-   Display saved experiences
-   Separate upcoming and expired items
-   Allow users to remove saved items
-   Open saved experience details

### Possible Layout

``` text
Saved

Upcoming

[ Trivia Night ]
Friday • 7 PM

[ Taco Tuesday ]
Tuesday • 5 PM

[ Live Music ]
Saturday • 8 PM
```

Expired experiences should not remain in the active upcoming list.

------------------------------------------------------------------------

## 6.5 Experience Details Screen

### Required Information

-   Image
-   Title
-   Business or organizer
-   Description
-   Category
-   Price
-   Date
-   Start time
-   End time
-   Address
-   Distance
-   Requirements
-   Expiration
-   Website
-   Save button
-   Directions button

### Possible Layout

``` text
[ Experience Image ]

Taco Tuesday

Joe's Tacos

Food • Mexican • Cheap

$2 tacos

Today
5:00 PM – 9:00 PM

123 Main Street
1.4 miles away

Description...

Requirements:
Dine-in only

Expires:
9:00 PM today

[ Save ]
[ Get Directions ]
```

------------------------------------------------------------------------

## 7. Domain Model

The application should separate businesses from experiences.

An experience may be hosted by a business, organization, or event
organizer.

## 7.1 Business

Suggested fields:

``` text
Business
--------
id
name
description
address
city
state
zip
latitude
longitude
phone
website
imageUrl
createdAt
updatedAt
```

## 7.2 Experience

The term `Experience` is used as a broad domain object that can
represent an offer, event, activity, or special.

Suggested fields:

``` text
Experience
----------
id
businessId
title
description
type
price
imageUrl
startDate
endDate
startTime
endTime
isRecurring
recurrenceRule
active
createdAt
updatedAt
```

### Experience Types

``` text
OFFER
EVENT
ACTIVITY
SPECIAL
```

## 7.3 Category

``` text
Category
--------
id
name
icon
```

Possible categories:

-   Food
-   Music
-   Sports
-   Games
-   Date Night
-   Family
-   College
-   Entertainment
-   Outdoors
-   Arts
-   Free
-   Cheap

## 7.4 Tags

Tags provide more flexible filtering and recommendation logic.

Example:

``` text
Taco Tuesday

Categories:
Food
Cheap

Tags:
Mexican
Casual
Tuesday
Under $10
Date Friendly
```

## 7.5 User

``` text
User
----
id
email
displayName
createdAt
```

## 7.6 User Preferences

``` text
UserPreferences
---------------
userId
maxDistance
maxPrice
favoriteCategories
```

## 7.7 Favorite

``` text
Favorite
--------
userId
experienceId
createdAt
```

------------------------------------------------------------------------

## 8. Database Relationships

Conceptual relationship:

``` text
USER
 |
 +---- FAVORITES ---- EXPERIENCE
 |
 +---- PREFERENCES

BUSINESS
 |
 +---- many EXPERIENCES

EXPERIENCE
 |
 +---- many CATEGORIES
 |
 +---- many TAGS
```

A relational database is recommended because the application contains
related entities, filtering, dates, recurring schedules, and user
relationships.

------------------------------------------------------------------------

## 9. Recurring Experiences

Recurring experiences are a major feature.

The database should not require a separate record for every occurrence
of a recurring promotion.

### Example

Instead of storing:

``` text
Taco Tuesday — September 15
Taco Tuesday — September 22
Taco Tuesday — September 29
```

store:

``` text
Title:
Taco Tuesday

Recurring:
true

Day:
Tuesday

Time:
5 PM – 9 PM
```

The application determines whether the experience is active on a
particular date and time.

### Initial Recurrence Support

The first version should support:

-   Specific days of the week
-   Start and end dates
-   Start and end times
-   Active/inactive status

More complex recurrence rules can be added later.

------------------------------------------------------------------------

## 10. Android Architecture

The existing project is an Android application using:

-   Kotlin
-   Jetpack Compose
-   Material 3
-   Gradle Kotlin DSL

The current starter structure should be expanded rather than replaced.

### Proposed Package Structure

``` text
com.example.hyenaapp

├── data
│   ├── model
│   ├── repository
│   ├── remote
│   └── local
│
├── domain
│   ├── model
│   └── usecase
│
├── ui
│   ├── home
│   ├── explore
│   ├── map
│   ├── details
│   ├── saved
│   ├── surprise
│   ├── settings
│   └── components
│
├── navigation
│
└── MainActivity.kt
```

### Architectural Pattern

Use:

``` text
Composable
    |
    v
ViewModel
    |
    v
Use Case
    |
    v
Repository
    |
    v
API / Local Database
```

The UI should not directly communicate with the database.

------------------------------------------------------------------------

## 11. UI State

Each major screen should have a clear UI state.

Example:

``` text
HomeUiState
-----------
isLoading
experiences
errorMessage
selectedCategory
selectedDate
```

Possible states:

-   Loading
-   Success
-   Empty
-   Error

The application should provide useful empty and error screens instead of
showing a blank page.

------------------------------------------------------------------------

## 12. Backend Architecture

The long-term architecture should be:

``` text
Android App
    |
    v
REST API
    |
    v
Backend
    |
    v
PostgreSQL
```

### Backend Responsibilities

-   Authentication
-   Businesses
-   Experiences
-   Categories
-   Search
-   Filtering
-   Recurrence
-   Recommendations
-   Favorites
-   User preferences
-   Data validation

### Database Recommendation

PostgreSQL is a strong choice because it supports:

-   Relational data
-   Date and time queries
-   Filtering
-   Constraints
-   Relationships
-   Structured querying
-   Future scalability

------------------------------------------------------------------------

## 13. Recommendation System

The first recommendation system does not need artificial intelligence.

A deterministic scoring algorithm is easier to implement, test, explain,
and demonstrate.

### Candidate Factors

-   Category match
-   Time relevance
-   Distance
-   Price match
-   Expiration urgency
-   Popularity
-   User preferences
-   Availability
-   Whether the experience is currently active

### Conceptual Formula

``` text
Recommendation Score =
    categoryMatch
  + timeRelevance
  + distanceScore
  + priceMatch
  + expirationUrgency
  + popularity
  + userPreference
```

### Example

``` text
Experience: Taco Tuesday

Category match:       +25
Time relevance:       +20
Distance:             +15
Price match:          +10
Ending soon:          +15
Popularity:            +5
                      ----
Total score:           90
```

The application sorts candidate experiences by score.

The exact weights can be adjusted after testing.

------------------------------------------------------------------------

## 14. Surprise Me Feature

### Basic Flow

1.  Retrieve active experiences.
2.  Remove expired experiences.
3.  Apply user filters.
4.  Apply user preferences.
5.  Calculate recommendation scores.
6.  Select a high-scoring result.
7.  Display the result.

A small amount of randomness can be introduced so the user does not
always receive the same recommendation.

------------------------------------------------------------------------

## 15. Build My Night Feature

This should be a stretch goal.

### User Inputs

-   Budget
-   Available time
-   Preferred vibe
-   Maximum distance
-   Group type

Example:

``` text
Budget:
$40

Time:
6 PM – 10 PM

Vibe:
Date Night

Distance:
10 miles
```

### Example Output

``` text
YOUR NIGHT

6:30 PM
Dinner
$15

7:45 PM
Trivia Night
$5

9:15 PM
Dessert Special
$8

Total:
$28
```

This feature could use:

-   Experience duration
-   Travel time
-   Price
-   Distance
-   Time compatibility
-   Category preferences

------------------------------------------------------------------------

## 16. Location System

The location system should eventually support:

-   Device location
-   Distance calculations
-   Nearby filtering
-   Map markers
-   Directions
-   Location-based recommendations

### Incremental Implementation

Start with:

-   Selected city or area
-   Stored latitude/longitude
-   Calculated distance

Then add:

-   Device location permission
-   Current location
-   Map integration
-   Directions

Location should not block the first working prototype.

------------------------------------------------------------------------

## 17. Data Population Strategy

The project should initially use a curated dataset rather than depending
entirely on web scraping.

Suggested starting dataset:

``` text
50–100 businesses
150–300 experiences
10–15 categories
```

Each record should contain realistic:

-   Titles
-   Descriptions
-   Dates
-   Times
-   Prices
-   Locations
-   Categories
-   Tags
-   Recurrence rules
-   Expiration data

External APIs can be added later.

------------------------------------------------------------------------

## 18. MVP Definition

The MVP should answer one question well:

> **What can I do today?**

### MVP Requirements

-   Android application
-   Kotlin
-   Jetpack Compose
-   Home screen
-   Explore screen
-   Search
-   Categories
-   Experience detail screen
-   Real database
-   Businesses
-   Experiences/offers
-   Date filtering
-   Time filtering
-   Recurring experiences
-   Favorites
-   Location/distance
-   Map
-   Basic recommendation system
-   Loading states
-   Empty states
-   Error handling
-   Basic testing

### Not Required for MVP

-   Business accounts
-   User authentication
-   Push notifications
-   Weather integration
-   Artificial intelligence
-   External event APIs
-   Build My Night
-   Advanced analytics

------------------------------------------------------------------------

## 19. Stretch Features

### Tier 1

-   User accounts
-   Personal preferences
-   Improved recommendations
-   Surprise Me
-   Push notifications

### Tier 2

-   Build My Night
-   Weather integration
-   Calendar integration
-   External event APIs
-   Share an experience

### Tier 3

-   Business portal
-   Business login
-   Create and edit experiences
-   Recurring schedule management
-   Analytics dashboard
-   Views and saves
-   Expired-offer management

------------------------------------------------------------------------

## 20. Development Roadmap

## Milestone 1 --- Foundation

Tasks:

-   Confirm project configuration
-   Create package structure
-   Create navigation
-   Establish app theme
-   Create domain models
-   Create basic UI states

Goal:

> A clean application skeleton.

## Milestone 2 --- Static UI

Tasks:

-   Build Home
-   Build Explore
-   Build Details
-   Build Saved
-   Build Map placeholder
-   Use temporary sample data

Goal:

> A complete user flow without a backend.

## Milestone 3 --- Database and API

Tasks:

-   Create businesses
-   Create experiences
-   Create categories
-   Create users
-   Create favorites
-   Connect Android to backend

Goal:

> Display real data.

## Milestone 4 --- Discovery Engine

Tasks:

-   Date filtering
-   Time filtering
-   Category filtering
-   Price filtering
-   Distance filtering
-   Expiration logic
-   Recurrence logic

Goal:

> Hyena understands what is relevant.

## Milestone 5 --- Recommendations

Tasks:

-   Recommendation scoring
-   Surprise Me
-   User preferences
-   Ranking and sorting

Goal:

> Hyena provides useful discovery rather than a basic list.

## Milestone 6 --- Maps and Location

Tasks:

-   Device location
-   Distance calculation
-   Map markers
-   Directions
-   Nearby experiences

Goal:

> Connect digital discovery with real-world locations.

## Milestone 7 --- Polish and Testing

Tasks:

-   Loading states
-   Empty states
-   Error handling
-   Animations
-   Accessibility
-   UI testing
-   Unit testing
-   Branding
-   App icon
-   Onboarding

Goal:

> A polished senior-project application.

------------------------------------------------------------------------

## 21. Testing Strategy

## Unit Tests

Test:

-   Expired experiences are excluded
-   Recurring experiences appear on the correct days
-   Price filters work
-   Distance filters work
-   Recommendation scores are calculated correctly
-   Experiences sort correctly
-   Favorites are added and removed

## UI Tests

Test:

-   Home opens correctly
-   Home to Details
-   Explore search
-   Explore filters
-   Details to Save
-   Saved to Details
-   Map marker selection

## Integration Tests

Test:

``` text
Android App
    |
    v
API
    |
    v
Database
```

Test successful requests, failures, empty responses, and invalid data.

------------------------------------------------------------------------

## 22. GitHub Workflow

Use the repository as a project-management tool.

### Branches

``` text
master
    |
    ├── feature/navigation
    ├── feature/home
    ├── feature/explore
    ├── feature/details
    ├── feature/database
    ├── feature/recurrence
    ├── feature/favorites
    ├── feature/recommendations
    └── feature/maps
```

### Suggested Issues

``` text
#1 Define domain models
#2 Create package structure
#3 Create navigation
#4 Build Home screen
#5 Build Explore screen
#6 Build Experience Details screen
#7 Build Saved screen
#8 Create backend
#9 Create database schema
#10 Add sample data
#11 Implement date/time filtering
#12 Implement recurrence
#13 Implement favorites
#14 Implement distance filtering
#15 Implement recommendation scoring
#16 Implement Surprise Me
#17 Implement maps
#18 Add unit tests
#19 Add UI tests
#20 Polish application
```

### Development Rule

Do not make broad changes directly to `master`.

Use this workflow:

``` text
Plan
  |
  v
Create issue
  |
  v
Create feature branch
  |
  v
Implement
  |
  v
Test
  |
  v
Review
  |
  v
Merge
```

------------------------------------------------------------------------

## 23. Senior Project Value

Hyena is more than a simple CRUD application.

The project combines:

-   Mobile development
-   Kotlin
-   Jetpack Compose
-   Relational database design
-   REST API development
-   Date and time logic
-   Recurring-event logic
-   Location-based filtering
-   Recommendation algorithms
-   Search and filtering
-   User preferences
-   Testing
-   UI/UX design

### Technical Project Statement

> Hyena is a location-aware mobile discovery application designed to
> help users discover time-sensitive local experiences and promotions.
> The application combines a relational data model, temporal filtering,
> recurring-event logic, location-based filtering, and a recommendation
> algorithm to surface relevant experiences based on the user's
> circumstances.

------------------------------------------------------------------------

## 24. Initial Technical Decisions

The current proposed decisions are:

  Area                Proposed Choice
  ------------------- -----------------------------------
  Platform            Android
  Language            Kotlin
  UI                  Jetpack Compose
  Design System       Material 3
  Architecture        ViewModel + Use Case + Repository
  Backend             REST API
  Database            PostgreSQL
  Data Model          Relational
  Maps                Add during location milestone
  Authentication      Optional for MVP
  Recommendations     Rule-based scoring
  Initial Data        Curated dataset
  Version Control     GitHub
  Development Style   Feature branches + issues

------------------------------------------------------------------------

## 25. Decisions Still to Finalize

Before implementation begins, the following decisions should be
confirmed:

1.  Final app name and branding
2.  Target geographic area for initial data
3.  Whether the MVP requires user accounts
4.  Backend language and framework
5.  Database hosting provider
6.  Mapping provider
7.  Whether experiences and offers share one model
8.  Exact recurrence rules
9.  Exact recommendation weights
10. Whether businesses can create their own listings
11. Whether the app supports only Android or Android plus web
12. Whether the initial data is manually curated or imported
13. Project deadline and milestone dates
14. Team members and responsibilities
15. Required senior-project documentation

------------------------------------------------------------------------

## 26. Recommended Immediate Next Steps

The next implementation sequence should be:

1.  Confirm the blueprint
2.  Choose the initial geographic area
3.  Decide the MVP feature list
4.  Finalize the database schema
5.  Finalize the Android package structure
6.  Create the navigation skeleton
7.  Create the domain models
8.  Build the static Home screen
9.  Build the remaining screens
10. Choose and create the backend
11. Connect the database
12. Implement discovery logic
13. Implement recommendations
14. Test and polish

------------------------------------------------------------------------

## 27. Guiding Principle

Every feature should answer:

> **Does this make discovering something to do easier?**

Every technical decision should answer:

> **Can we explain why this decision exists?**

The goal is to build a useful application while maintaining a clear
architecture that can be explained, tested, and demonstrated during the
senior-project presentation.
