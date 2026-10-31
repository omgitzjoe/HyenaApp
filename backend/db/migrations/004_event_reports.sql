BEGIN;
CREATE TABLE IF NOT EXISTS event_reports (
    id UUID PRIMARY KEY,
    experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('CANCELLED','WRONG_TIME','WRONG_LOCATION','WRONG_PRICE','OTHER')),
    details TEXT NOT NULL DEFAULT '' CHECK (length(details) <= 1000),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS event_reports_queue ON event_reports(status,created_at DESC);
COMMIT;
