const fs = require('node:fs/promises');
const path = require('node:path');

// Only additive application migrations belong here. Never run schema/seed resets.
async function migrate(pool) {
    const sql = await fs.readFile(path.join(__dirname, '../db/migrations/002_event_submissions.sql'), 'utf8');
    const client = await pool.connect();
    let locked = false;
    let failed = false;
    try {
        await client.query('SELECT pg_advisory_lock(194712, 2)');
        locked = true;
        await client.query(sql);
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
