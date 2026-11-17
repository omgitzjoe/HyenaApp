BEGIN;
ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS auto_publish_blocked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS venue_lookup_cache (
    query TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);
INSERT INTO categories (id,name,slug)
SELECT 'e9d8a249-4259-4b2f-93dc-d75876f293da', 'Other', 'other'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug='other' OR lower(name)='other');
COMMIT;
