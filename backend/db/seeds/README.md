# Fictional discovery catalog

All 225 experiences and 50 venues are fictional. Descriptions identify them as mock listings; coordinates are approximate demo positions. The 16 categories are Food, Music, Games, Family, Outdoors, Arts, Sports, College, Entertainment, Date Night, Learning, Markets, Community, Movies, Seasonal, and Wellness.

## Update the existing database

Run **refresh_mock_catalog.sql** as an entire script in DBeaver. It is transactional, preserves existing catalog IDs, and updates only the known demo catalog and its schedule/category relationships. It does not modify users or sessions or delete unrelated listings. Friendly category-name collisions preserve the unrelated category and give the mock category a Demo suffix. No schema migration is required.

Use **sample_data.sql** only for the complete fixture setup on a fresh development/test database; it also upserts public demo users and sessions. Do not copy those fixtures into real authentication workflows.

Saved phone snapshots deliberately retain old names until you remove and re-save them. Catalog ID preservation keeps database references intact, but does not silently rewrite offline snapshots.

## Main coverage pattern

The main matrix has twelve variants for each category, with one intentionally unpublished draft. Every category has live Today/Now/Free coverage and an unknown-price example. Most routine schedules repeat daily and remain useful after the refresh day.

| Variant | USD price | Schedule or filter purpose |
| --- | --- | --- |
| Self-guided/community activity | 0 | Full-day recurring window, ongoing, Today and Tonight |
| Lunch promotion | 0.01 | Penny-price lower bound, 11:00–13:00 |
| Afternoon activity | 4.99 | Just below $5, 16:00–18:00 |
| Evening gathering | 5.00 | Exact $5 boundary, 17:00–21:00 |
| Evening workshop | 9.99 | Just below $10, 18:00–22:00 |
| Late social | 10.00 | Exact $10 boundary, 21:00–23:00 |
| After-hours activity | 10.01 | Just above $10, 23:00–02:00 overnight |
| Short-session meetup | 24.99 | Ongoing at refresh time: starts 30 minutes before refresh, ends 45 minutes after |
| Tomorrow activity | 25.00 | Exact $25 boundary, one-time tomorrow |
| Next-week activity | 25.01 | Just above $25, one-time seven days ahead |
| Historical activity | 50.00 | Yesterday, accessible through selected date/All dates |
| Open studio/drop-in | Unknown | Excluded by Free and Maximum price, available under Any price |

An additional 33 records cover inactive listings/businesses/areas, missing coordinates, online UTC schedules, duplicate titles at different venues, Unicode/apostrophes/literal `%` and `_`, premium prices, multi-category links, weekday-specific recurrence, future start and expired/bounded weekly schedules, and fixed DST/leap-day dates. Invalid records such as negative prices remain in rollback constraint tests instead of appearing as realistic catalog offers.

Discovery locations include Rexburg, Idaho Falls, Boise, New York, Los Angeles, Phoenix, Tokyo, and an online UTC area. Five nearby price/time variants per category concentrate around Rexburg so 5/10/25-mile tests are useful there. Other variants span the different zones. Island Park intentionally has no venues; West Bench is inactive. An active venue without coordinates is visible through manual discovery but excluded from Near me.

## Regenerate and verify

```text
python backend/db/seeds/generate_mock_data.py
cd backend
npm test
```

The generator preserves the current identity lists, produces both SQL files without blank statement separators, and retains public account/session fixtures only in the full setup file. Rerunning refresh moves relative one-time examples; it is not required daily for weekly examples. Automated tests exercise each category/filter, repeat the refresh, preserve an unrelated category and demo accounts, and run the rollback constraints against the refreshed catalog.
