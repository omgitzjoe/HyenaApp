BEGIN;
-- Individually verified live test submissions, separate from the fictional seed catalog.
CREATE TEMP TABLE hyena_verified_tests ON COMMIT DROP AS
 SELECT e.id FROM experiences e JOIN (VALUES
 ('85395e8d-3f49-493a-af24-724c6b9e6313'::uuid,'Location workflow verification — reject after review'),
 ('d38acba1-bc40-41d4-9a8e-adf26b26a38d'::uuid,'test')
 ) AS verified(id,title) ON e.id=verified.id AND e.title=verified.title;
DELETE FROM event_reports WHERE experience_id IN (SELECT id FROM hyena_verified_tests);
DELETE FROM event_submissions WHERE published_experience_id IN (SELECT id FROM hyena_verified_tests);
DELETE FROM experiences WHERE id IN (SELECT id FROM hyena_verified_tests);
DELETE FROM businesses b WHERE b.id='e766f983-a47d-4e19-9f83-7da9292c4459' AND b.name='Location workflow test studio'
 AND NOT EXISTS(SELECT 1 FROM experiences e WHERE e.business_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM event_submissions s WHERE s.payload#>>'{venue,businessId}'=b.id::text);
COMMIT;
