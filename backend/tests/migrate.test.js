const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { migrate } = require('../scripts/migrate');

test('startup migrates an existing area database without losing venues, schedules or pending submissions; reruns skip applied work', async () => {
    const db = new PGlite();
    const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
    let releases = 0;
    const pool = { async connect() { return {
        async query(sql, args) {
            if (/pg_advisory_(un)?lock/.test(sql)) return {rows:[]};
            if (!args && sql.split(';').filter(x=>x.trim()).length > 1) { await db.exec(sql); return {rows:[]}; }
            return db.query(sql,args);
        },
        release() { releases++; }
    }; } };
    try {
        await db.waitReady;
        await db.exec(read('fixtures/legacy_schema.sql'));
        await db.exec(read('../db/migrations/002_event_submissions.sql'));
        await db.exec(`INSERT INTO discovery_areas(id,name,slug,time_zone) VALUES ('00000000-0000-4000-8000-000000000001','Legacy','legacy','America/Denver');
            INSERT INTO businesses(id,area_id,name,address,city,latitude,longitude) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Studio','1 Main','New York',40.7128,-74.006);
            INSERT INTO experiences(id,business_id,title,description,type) VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Reading','All day','EVENT');
            INSERT INTO experience_schedules(experience_id,kind,start_date,end_date,start_time,end_time,ends_next_day,time_zone) VALUES ('00000000-0000-4000-8000-000000000003','ONCE','2030-01-01','2030-01-01','00:00','00:00',TRUE,'America/Denver');
            INSERT INTO event_submissions(id,client_request_id,payload) VALUES (gen_random_uuid(),gen_random_uuid(),' {"venue":{"proposal":{"areaId":"00000000-0000-4000-8000-000000000001","name":"Old proposal"}},"event":{}}');`);
        await migrate(pool);
        assert.equal((await db.query("SELECT to_regclass('discovery_areas') AS name")).rows[0].name,null);
        const venue = (await db.query('SELECT * FROM businesses')).rows[0];
        assert.equal(venue.name,'Studio');assert.equal(venue.time_zone,'America/New_York');assert.ok(!('area_id' in venue));
        const schedule = (await db.query('SELECT * FROM experience_schedules')).rows[0];
        assert.equal(schedule.all_day,true);assert.equal(schedule.end_time,'23:59:00');assert.equal(schedule.ends_next_day,false);assert.equal(schedule.time_zone,'America/New_York');
        assert.equal((await db.query('SELECT payload FROM event_submissions')).rows[0].payload.venue.proposal.areaId,undefined);
        await db.query("UPDATE businesses SET time_zone='UTC'");
        await migrate(pool);
        assert.equal((await db.query('SELECT time_zone FROM businesses')).rows[0].time_zone,'UTC');
        assert.equal((await db.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,2);
        assert.equal(releases,2);
    } finally { await db.close(); }
});

test('migration failure rolls back, releases the lock, and propagates to stop startup', async () => {
    const queries=[];let destroyed=false;
    const pool={async connect(){return {async query(sql){queries.push(sql);if(sql.startsWith('CREATE TABLE'))throw Error('DDL denied');return {rows:[]};},release(error){destroyed=error;}};}};
    await assert.rejects(migrate(pool),/DDL denied/);
    assert.equal(queries.at(-2),'ROLLBACK');assert.match(queries.at(-1),/pg_advisory_unlock/);assert.equal(destroyed,true);
});
