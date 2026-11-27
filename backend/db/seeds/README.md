# Category seed

`sample_data.sql` optionally bootstraps Entertainment, Arts, Fitness, Food, Family, and Other on a fresh schema. It creates no venues, events, or accounts. Normal startup also ensures these categories through migration 010.

On an existing database use `npm run migrate` or `npm start`; do not reset the schema or reseed the database. Migration 010 preserves event records and remaps their categories and editable review submissions. Free and Cheap are not categories; the separate price filters use the actual event price. Legacy categories without a specific match go to Other.

The old mock catalog generator and its identities describe a historical, pre-lightweight schema; do not run the generator or its output against a current database. Historical fixtures are kept under `backend/tests/fixtures` and run only by tests.
