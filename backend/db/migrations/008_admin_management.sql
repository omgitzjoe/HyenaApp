BEGIN;
ALTER TABLE event_submissions DROP CONSTRAINT valid_submission_review;
ALTER TABLE event_submissions DROP COLUMN review_note;
ALTER TABLE event_submissions ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'USER' CHECK(source_kind IN ('USER','FEED'));
-- Feed request IDs are deterministic version-8 UUIDs; app submissions use random version-4 IDs.
UPDATE event_submissions SET source_kind='FEED' WHERE substring(client_request_id::text,15,1)='8' AND payload#>>'{event,sourceUrl}' IS NOT NULL;
-- Keep original retry identity separate from admin-editable review data.
ALTER TABLE event_submissions ADD COLUMN request_payload JSONB;
UPDATE event_submissions SET request_payload=payload;
ALTER TABLE event_submissions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_submissions ADD COLUMN duplicate_of UUID REFERENCES experiences(id) ON DELETE SET NULL;
ALTER TABLE event_submissions ADD CONSTRAINT valid_submission_review CHECK(
 (status='PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL AND published_experience_id IS NULL)
 OR (status='APPROVED' AND reviewed_at IS NOT NULL AND NULLIF(btrim(reviewed_by),'') IS NOT NULL AND published_experience_id IS NOT NULL)
 OR (status='REJECTED' AND reviewed_at IS NOT NULL AND NULLIF(btrim(reviewed_by),'') IS NOT NULL AND published_experience_id IS NULL));
CREATE INDEX event_submissions_source_queue ON event_submissions(status,source_kind,created_at DESC,id DESC);
-- Retire exact duplicates already published at the same venue and local start.
CREATE TEMP TABLE hyena_duplicate_events ON COMMIT DROP AS
 SELECT id,canonical_id FROM (
  SELECT e.id,first_value(e.id) OVER (PARTITION BY
   lower(regexp_replace(e.title,'[^a-zA-Z0-9]','','g')),e.business_id,s.kind,s.start_date,s.start_time,s.all_day,COALESCE(s.time_zone,'America/Denver')
   ORDER BY e.created_at,e.id) AS canonical_id
  FROM experiences e JOIN experience_schedules s ON s.experience_id=e.id WHERE e.is_active AND s.kind='ONCE' AND regexp_replace(e.title,'[^a-zA-Z0-9]','','g')<>''
 ) ranked WHERE id<>canonical_id;
UPDATE experiences SET is_active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id IN(SELECT id FROM hyena_duplicate_events);
UPDATE event_submissions s SET status='REJECTED',published_experience_id=NULL,duplicate_of=d.canonical_id,
 reviewed_by='Duplicate cleanup',reviewed_at=CURRENT_TIMESTAMP,revision=revision+1
 FROM hyena_duplicate_events d WHERE s.published_experience_id=d.id;
COMMIT;
