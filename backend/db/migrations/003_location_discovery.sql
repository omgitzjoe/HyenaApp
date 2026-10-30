-- Additive venue backfill, then retire the obsolete area relationship. No catalog reset.
BEGIN;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS time_zone TEXT;
ALTER TABLE experience_schedules ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='businesses' AND column_name='area_id') THEN
        UPDATE businesses b SET time_zone=COALESCE(b.time_zone,a.time_zone), is_active=(b.is_active AND a.is_active) FROM discovery_areas a WHERE a.id=b.area_id;
        ALTER TABLE businesses DROP COLUMN area_id;
    END IF;
END $$;
DROP TABLE IF EXISTS discovery_areas;
UPDATE experience_schedules SET all_day=TRUE,start_time='00:00',end_time='23:59',ends_next_day=FALSE WHERE start_time='00:00' AND end_time='00:00' AND ends_next_day=TRUE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='experience_schedules'::regclass AND conname='valid_all_day') THEN
        ALTER TABLE experience_schedules ADD CONSTRAINT valid_all_day CHECK (NOT all_day OR (start_time=TIME '00:00' AND end_time=TIME '23:59' AND ends_next_day=FALSE));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_businesses_coordinates_active ON businesses(latitude,longitude) WHERE is_active=TRUE;
COMMIT;
