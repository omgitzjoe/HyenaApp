# Display preferences and venue suggestions — October 30, 2026

## Appearance and persistence

New installs start in Light regardless of the device's system theme. The global Appearance action opens explicit Light/Dark choices, saved on the phone. The light palette uses warm white, sage and gold with subtle header gradients; the established dark palette is retained. Status/navigation icon brightness follows the selected app theme.

The same private preferences snapshot stores the applied Explore keyword query, radius, category set, time window/selected calendar date, price mode, and applied maximum price. Changes update memory immediately and queue ordered SharedPreferences disk writes. Clear filters resets those search values while preserving theme. Invalid or obsolete saved values are normalized on load; unavailable categories are pruned after the category list loads. Coordinates are never saved. Unapplied price drafts and submission drafts are not cross-session preferences.

Times display in 12-hour AM/PM format on Home, Explore, Saved, Details and the review dashboard. Start/end controls in the event form use a 12-hour time input with AM/PM choices. Underlying API/SQL schedule values remain normalized HH:mm(:ss), and UTC occurrence instants remain unchanged. All Day shows disabled 12:00 AM and 11:59 PM controls. Noon and midnight have separate regression assertions.

## Venue suggestions

The event form receives the same search radius as discovery. By default it fetches active located venues within that radius. Search all venues removes the radius restriction; it can also work without a current position. Nearby mode needs a location. Changing the mode clears the selection so the user chooses from the new scope.

Typing a name, street, or city triggers a 300 ms debounce and cancellable request. Old suggestions clear immediately when the query changes. Up to eight inline suggestions show venue name, address/city, and distance when available; selecting one records the venue ID and shows a confirmation panel. Change venue returns to the suggestions. The old dropdown is removed. Number prefixes were removed from form headings.

GET /api/v1/businesses accepts q, paired latitude/longitude, radiusMiles (1–100, default 10), and searchAll=true|false (default false). Nearby scope is applied before sorting and the 50-result response limit. All-venue mode still returns only active located venues. The private review dashboard explicitly sends searchAll=true for venue matching. No schema change or new Render setting is required.

## Updated mascot

The current original generated asset is `app/src/main/res/drawable-nodpi/hyena_mascot_realistic.png`. PageHeader and adaptive launcher foreground reference it. The earlier illustrated mascot is retained as an alternative asset. The supplied wildlife photograph is an anatomy/style reference and is not bundled. Generation used the built-in image-generation tool; the output is original generated artwork, not a downloaded stock photo. No public-domain certification is claimed.

Final prompt:

> Create original artwork of a spotted hyena for an Android app mascot and launcher icon. The attached wildlife photo is reference for animal anatomy and rugged natural character only. New pose and composition: a close three-quarter portrait of a real-looking adult spotted hyena's head and upper shoulders, looking toward viewer, with enormous rounded ears, a sloping powerful neck, coarse untidy sandy brown fur, dark irregular spots, charcoal muzzle and black nose, subtle scars/weathering, alert intelligent eyes, slightly lowered scavenger posture. Authentically hyena rather than wolf, dog, fox or cat. Serious curious expression, mouth naturally closed, not smiling or anthropomorphic. Photorealistic wildlife portrait with just enough illustrative simplification to read as an elegant mascot at small sizes. Earthy warm tan, dark brown, natural muted olive accents. Clean isolated silhouette on actual transparent background. All ears and neck fully within the image, centered head inside central 65 percent of a square with substantial transparent padding for adaptive icon masking. No ground, no scenery, no text, badge, border, watermark, clothing, bones, blood or prey. One animal only. Do not copy the photograph's composition or background.

## Device acceptance

Rebuild/install from master. Verify first launch in an OS-dark device still uses Light; choose Dark, close/reopen, and check it stays Dark. Set every Explore filter, close/reopen, and confirm values/results are restored. Clear filters, restart, and check defaults while theme stays selected. Check noon, midnight, overnight, All Day and saved-card display.

On Submit event, compare nearby and all-venue searches, type quickly to check stale suggestions, select/change a venue, and try permission denial with Search all. Confirm time input has AM/PM and the review dashboard shows the matching occurrence after approval. Check both themes, keyboard overlap, enlarged fonts and launcher masks. Backend tests run locally; Android tests and device visual acceptance require Android Studio when this environment cannot download Gradle.
