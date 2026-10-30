# Hyena interface and mascot — October 30, 2026

Home and Explore sort eligible results by occurrence start, then distance for matching start times, before limiting the list. The radius excludes distant experiences first. Title and ID make remaining ties stable; undated listings come last. All dates retains historical occurrences for inspection. There is no schema or seed change for this sorting/UI update.

For saved appearance/search preferences, 12-hour time entry, nearby live venue suggestions and the current realistic mascot, see [Preferences_and_Venue_Search.md](Preferences_and_Venue_Search.md). That update supersedes the numbered sections and original mascot references below.

The interface uses forest green, warm neutral surfaces, and a gold accent drawn from the new mascot. Both light and dark palettes have explicit text/surface roles. Typography has distinct page titles, event titles, field labels, and supporting text. Rounded surface panels organize headers, filters, cards, details, and submission sections. Navigation uses recognizable Home, Search, and Bookmark icons; the event action is labeled Submit event. Lists reserve bottom space for the floating action. Location radius chips scroll on narrow screens; the schedule checkbox labels wrap within their own columns.

Cards prioritize venue, event title, schedule, and price in separate sections. Distance remains visible in a compact badge. No event title is truncated. Saved uses the same cards; Details uses consistent information panels. Font sizes use sp and inherit system font scaling. Foreground location, saving behavior, request idempotency, review authorization and the local-time conversion remain unchanged.

## Original mascot asset

- Source / app asset: `app/src/main/res/drawable-nodpi/hyena_mascot.png` (transparent original raster artwork).
- App header: PageHeader uses it decoratively without a redundant accessibility label.
- Launcher: adaptive foreground references the mascot through an inset, with a warm-gold background. Round and themed icons reuse its transparent silhouette. The app label is Hyena. API 28+ is the supported range, so obsolete Android-robot density fallbacks were removed.
- Generation method: built-in image generation, followed by direct copying into the repository. No generative API credentials are stored.

Final generation prompt:

> Use case: logo-brand. Create a single original hyena mascot head for the launcher icon of Hyena, a professional friendly local experiences discovery Android app. Transparent background, square composition. A clearly recognizable spotted hyena: very large rounded ears with dark interiors, short dark upright mane, broad charcoal muzzle and rounded dark nose, warm sandy gold fur, a few bold dark cheek spots, friendly confident closed-mouth smile, bright curious eyes. Front facing with slight characterful asymmetry. Crisp flat vector-like illustration, strong simple silhouette, thick clean charcoal outlines, restrained colors, excellent readability at 48 pixels. Head only, no body, no letters or text, no border, no badge or background, no gradients, no mockup. Keep all ears and mane fully inside the central 65 percent of the image with generous transparent padding for Android adaptive icon masking. This is an original brand character, not a reference to any existing mascot.

## Acceptance checks

Rebuild/reinstall to update both the interface and launcher resources; some launchers cache icons until restart. Inspect Home, Explore, Saved, Details, and Submit in light and dark themes. Check a narrow screen, enlarged fonts, long event titles, long prices, horizontal filter scrolling, and keyboard/date-picker behavior. Verify the full ears/head fit round and squircle launcher masks. Exercise time ties at different distances and an earlier event beyond the selected radius. Android compilation/device visual verification remains required when the build environment cannot download Gradle; syntax parsing alone cannot verify Compose API compatibility or visual layout.
