BEGIN;
ALTER TABLE event_submissions ADD COLUMN source_snapshot JSONB;
CREATE TABLE feed_changes(
 id UUID PRIMARY KEY,submission_id UUID NOT NULL REFERENCES event_submissions(id) ON DELETE CASCADE,
 fingerprint CHAR(64) NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('CANCELLATION','RESCHEDULE','DETAILS')),
 previous JSONB NOT NULL,incoming JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','IGNORED')),
 first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at TIMESTAMPTZ,resolved_by TEXT,UNIQUE(submission_id,fingerprint)
);
CREATE INDEX feed_changes_open ON feed_changes(status,last_seen_at DESC);
COMMIT;
