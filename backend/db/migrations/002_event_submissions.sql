-- Run the entire script once against the existing Hyena database. Safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS event_submissions (
    id UUID PRIMARY KEY,
    client_request_id UUID NOT NULL UNIQUE,
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    published_experience_id UUID UNIQUE REFERENCES experiences(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_note TEXT,
    CONSTRAINT valid_submission_review CHECK (
        (status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL AND published_experience_id IS NULL AND review_note IS NULL)
        OR (status = 'APPROVED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND btrim(reviewed_by) <> '' AND published_experience_id IS NOT NULL)
        OR (status = 'REJECTED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND btrim(reviewed_by) <> '' AND published_experience_id IS NULL AND review_note IS NOT NULL AND btrim(review_note) <> '')
    )
);
CREATE INDEX IF NOT EXISTS event_submissions_review_queue ON event_submissions (status, created_at, id);
CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    username TEXT NOT NULL,
    credential_version CHAR(64) NOT NULL,
    csrf_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);
COMMIT;
