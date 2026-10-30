-- Run AFTER 001_sample_data.sql. All test mutations are rolled back.
-- Execute the ENTIRE SCRIPT. If any FAIL appears, execute ROLLBACK; before continuing.
BEGIN;
DO $constraint_tests$
BEGIN
BEGIN
INSERT INTO users (email,password_hash) VALUES ('hyena.seed.user1@example.test','fixture-hash');
RAISE EXCEPTION 'FAIL: Duplicate user email was accepted';
EXCEPTION WHEN unique_violation THEN
RAISE NOTICE 'PASS: Duplicate user email rejected';
END;
BEGIN
INSERT INTO users (email,password_hash) VALUES ('UPPER@example.test','fixture-hash');
RAISE EXCEPTION 'FAIL: Uppercase unnormalized email was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Uppercase unnormalized email rejected';
END;
BEGIN
INSERT INTO users (email,password_hash) VALUES ('','fixture-hash');
RAISE EXCEPTION 'FAIL: Blank email was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Blank email rejected';
END;
BEGIN
INSERT INTO users (email,password_hash) VALUES ('reject-test@example.test','   ');
RAISE EXCEPTION 'FAIL: Blank password hash was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Blank password hash rejected';
END;
BEGIN
INSERT INTO saved_experiences (user_id,experience_id) VALUES ('15bfcf8a-0ecb-5f7e-9c67-7613c268edf9','dd41d05c-8ea0-5519-8e36-1f878d57aaf6');
RAISE EXCEPTION 'FAIL: Duplicate saved pair was accepted';
EXCEPTION WHEN unique_violation THEN
RAISE NOTICE 'PASS: Duplicate saved pair rejected';
END;
BEGIN
INSERT INTO saved_experiences (user_id,experience_id) VALUES ('ff5751d7-7930-502f-9e08-4f4fce43044d','dd41d05c-8ea0-5519-8e36-1f878d57aaf6');
RAISE EXCEPTION 'FAIL: Save for nonexistent user was accepted';
EXCEPTION WHEN foreign_key_violation THEN
RAISE NOTICE 'PASS: Save for nonexistent user rejected';
END;
BEGIN
DELETE FROM businesses WHERE id='89a68907-b5aa-5102-91bb-7e2f86a8b324';
RAISE EXCEPTION 'FAIL: Delete referenced business was accepted';
EXCEPTION WHEN foreign_key_violation OR SQLSTATE '23001' THEN
RAISE NOTICE 'PASS: Delete referenced business rejected';
END;
BEGIN
DELETE FROM experiences WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Delete saved experience was accepted';
EXCEPTION WHEN foreign_key_violation OR SQLSTATE '23001' THEN
RAISE NOTICE 'PASS: Delete saved experience rejected';
END;
BEGIN
DELETE FROM categories WHERE id='955c125a-00d4-5731-be1c-b06c9ba92710';
RAISE EXCEPTION 'FAIL: Delete linked category was accepted';
EXCEPTION WHEN foreign_key_violation OR SQLSTATE '23001' THEN
RAISE NOTICE 'PASS: Delete linked category rejected';
END;
BEGIN
UPDATE businesses SET latitude=91, longitude=0 WHERE id='89a68907-b5aa-5102-91bb-7e2f86a8b324';
RAISE EXCEPTION 'FAIL: Latitude outside range was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Latitude outside range rejected';
END;
BEGIN
UPDATE businesses SET latitude=0, longitude=181 WHERE id='89a68907-b5aa-5102-91bb-7e2f86a8b324';
RAISE EXCEPTION 'FAIL: Longitude outside range was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Longitude outside range rejected';
END;
BEGIN
UPDATE businesses SET latitude=NULL, longitude=0 WHERE id='89a68907-b5aa-5102-91bb-7e2f86a8b324';
RAISE EXCEPTION 'FAIL: Only one coordinate was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Only one coordinate rejected';
END;
BEGIN
UPDATE experiences SET title='   ' WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Blank title was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Blank title rejected';
END;
BEGIN
UPDATE experiences SET price_amount=-1 WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Negative price was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Negative price rejected';
END;
BEGIN
UPDATE experiences SET price_amount=2, currency=NULL WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Price without currency was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Price without currency rejected';
END;
BEGIN
UPDATE experiences SET type='UNKNOWN' WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Invalid experience type was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Invalid experience type rejected';
END;
BEGIN
UPDATE experiences SET price_amount=100000000 WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6';
RAISE EXCEPTION 'FAIL: Price exceeds numeric precision was accepted';
EXCEPTION WHEN numeric_value_out_of_range THEN
RAISE NOTICE 'PASS: Price exceeds numeric precision rejected';
END;
BEGIN
INSERT INTO experience_categories (experience_id,category_id) VALUES ('dd41d05c-8ea0-5519-8e36-1f878d57aaf6','955c125a-00d4-5731-be1c-b06c9ba92710');
RAISE EXCEPTION 'FAIL: Duplicate category pair was accepted';
EXCEPTION WHEN unique_violation THEN
RAISE NOTICE 'PASS: Duplicate category pair rejected';
END;
BEGIN
INSERT INTO experience_schedule_days (schedule_id,iso_weekday) VALUES ('9525e557-dedf-50ed-9de8-9bebe8ac0547',8);
RAISE EXCEPTION 'FAIL: Weekday outside range was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Weekday outside range rejected';
END;
BEGIN
INSERT INTO experience_schedule_days (schedule_id,iso_weekday) SELECT schedule_id,iso_weekday FROM experience_schedule_days ORDER BY schedule_id,iso_weekday LIMIT 1;
RAISE EXCEPTION 'FAIL: Duplicate schedule weekday was accepted';
EXCEPTION WHEN unique_violation THEN
RAISE NOTICE 'PASS: Duplicate schedule weekday rejected';
END;
BEGIN
UPDATE experience_schedules SET end_date=start_date-1 WHERE id='9525e557-dedf-50ed-9de8-9bebe8ac0547';
RAISE EXCEPTION 'FAIL: Backwards date range was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Backwards date range rejected';
END;
BEGIN
UPDATE experience_schedules SET kind='ONCE',end_date=NULL WHERE id='9525e557-dedf-50ed-9de8-9bebe8ac0547';
RAISE EXCEPTION 'FAIL: ONCE without end date was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: ONCE without end date rejected';
END;
BEGIN
UPDATE experience_schedules SET start_time='21:00',end_time='17:00',ends_next_day=FALSE WHERE id='9525e557-dedf-50ed-9de8-9bebe8ac0547';
RAISE EXCEPTION 'FAIL: Same-day end before start was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Same-day end before start rejected';
END;
BEGIN
UPDATE experience_schedules SET start_time='17:00',end_time='17:00',ends_next_day=FALSE WHERE id='9525e557-dedf-50ed-9de8-9bebe8ac0547';
RAISE EXCEPTION 'FAIL: Zero-length same-day event was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Zero-length same-day event rejected';
END;
BEGIN
UPDATE sessions SET expires_at=created_at-INTERVAL '1 second' WHERE id='383c23df-6e04-585e-a585-d1aa1c6ec953';
RAISE EXCEPTION 'FAIL: Session expiry before creation was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Session expiry before creation rejected';
END;
BEGIN
UPDATE sessions SET revoked_at=created_at-INTERVAL '1 second' WHERE id='383c23df-6e04-585e-a585-d1aa1c6ec953';
RAISE EXCEPTION 'FAIL: Session revoked before creation was accepted';
EXCEPTION WHEN check_violation THEN
RAISE NOTICE 'PASS: Session revoked before creation rejected';
END;
DELETE FROM users WHERE id='15bfcf8a-0ecb-5f7e-9c67-7613c268edf9';
IF EXISTS (SELECT 1 FROM saved_experiences WHERE user_id='15bfcf8a-0ecb-5f7e-9c67-7613c268edf9') OR EXISTS (SELECT 1 FROM sessions WHERE user_id='15bfcf8a-0ecb-5f7e-9c67-7613c268edf9') THEN RAISE EXCEPTION 'FAIL: user cascade'; END IF;
IF NOT EXISTS (SELECT 1 FROM experiences WHERE id='dd41d05c-8ea0-5519-8e36-1f878d57aaf6') THEN RAISE EXCEPTION 'FAIL: user deletion removed listing'; END IF;
RAISE NOTICE 'PASS: account deletion cascades private links and retains listings';
RAISE NOTICE 'All 28 rejection checks and the cascade check passed; rolling back.';
END;
$constraint_tests$;
ROLLBACK;
