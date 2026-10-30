const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../scripts/migrate');

function database(failMigration = false) {
    const queries = [];
    let destroyed;
    return {
        queries,
        get destroyed() { return destroyed; },
        async connect() {
            return {
                async query(sql) {
                    queries.push(sql);
                    if (failMigration && sql.includes('CREATE TABLE')) throw new Error('DDL denied');
                },
                release(destroy) { destroyed = destroy; }
            };
        }
    };
}

test('startup applies only the additive migration while holding a database lock', async () => {
    const pool = database();
    await migrate(pool);
    assert.match(pool.queries[0], /pg_advisory_lock/);
    assert.match(pool.queries[1], /CREATE TABLE IF NOT EXISTS event_submissions/);
    assert.doesNotMatch(pool.queries[1], /DROP TABLE|TRUNCATE|INSERT INTO experiences/i);
    assert.match(pool.queries[2], /pg_advisory_unlock/);
    assert.equal(pool.destroyed, false);
});

test('migration errors propagate and roll back before releasing the lock', async () => {
    const pool = database(true);
    await assert.rejects(migrate(pool), /DDL denied/);
    assert.equal(pool.queries[2], 'ROLLBACK');
    assert.match(pool.queries[3], /pg_advisory_unlock/);
    assert.equal(pool.destroyed, true);
});
