const fs = require('node:fs/promises');
const path = require('node:path');

// Only additive application migrations belong here. Never run schema/seed resets.
async function migrate(pool) {
    const client = await pool.connect();
    let locked = false;
    let failed = false;
    try {
        await client.query('SELECT pg_advisory_lock(194712, 2)');
        locked = true;
        await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        for (const name of ['002_event_submissions.sql', '003_location_discovery.sql', '004_event_reports.sql']) {
            if ((await client.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rows.length) continue;
            const sql = await fs.readFile(path.join(__dirname, '../db/migrations', name), 'utf8');
            await client.query('BEGIN');
            await client.query(sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''));
            if (name === '003_location_discovery.sql') {
                const { venueTimeZone } = require('../services/venueLocation');
                const venues = await client.query('SELECT id,latitude,longitude FROM businesses WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
                for (const venue of venues.rows) {
                    const zone = venueTimeZone(venue);
                    await client.query('UPDATE businesses SET time_zone=$2 WHERE id=$1', [venue.id, zone]);
                    await client.query('UPDATE experience_schedules SET time_zone=$2 FROM experiences e WHERE experience_schedules.experience_id=e.id AND e.business_id=$1', [venue.id, zone]);
                }
                // Preserve old queued proposals; a reviewer must supply coordinates if absent.
                await client.query("UPDATE event_submissions SET payload=jsonb_set(payload,'{venue,proposal}',(payload#>'{venue,proposal}')-'areaId') WHERE status='PENDING' AND payload#>'{venue,proposal}' IS NOT NULL");
            }
            await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
            await client.query('COMMIT');
        }
    } catch (error) {
        failed = true;
        try { await client.query('ROLLBACK'); } catch { /* Destroy the connection below. */ }
        throw error;
    } finally {
        try {
            if (locked) await client.query('SELECT pg_advisory_unlock(194712, 2)');
        } finally {
            client.release(failed);
        }
    }
}

if (require.main === module) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    const pool = require('../db');
    (async () => {
        try {
            await migrate(pool);
            console.log('Submission database setup complete.');
        } catch (error) {
            console.error('Submission database setup failed:', error.message);
            process.exitCode = 1;
        } finally {
            await pool.end();
        }
    })().catch(() => { process.exitCode = 1; });
}

module.exports = { migrate };
