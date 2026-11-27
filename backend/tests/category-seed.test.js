const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const createCategoryRouter = require('../routes/categories');
const { submitEvent } = require('../services/submissions');

test('checked-in schema and full seed expose category choices through HTTP', async () => {
    const db = new PGlite();
    let server;
    try {
        await db.waitReady;
        await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations/initial_schema.sql'),'utf8'));
        await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/legacy_sample_data.sql'),'utf8'));
        const app = express();app.use('/categories',createCategoryRouter({pool:db}));
        server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
        const response=await fetch(`http://127.0.0.1:${server.address().port}/categories`);
        const body=await response.json();
        assert.equal(response.status,200);assert.ok(body.count>=6);
        assert.equal(body.items.length,body.count);
        assert.ok(body.items.every(x=>typeof x.id==='string'&&x.name.trim().length>0));
        // A deployment missing optional icon metadata must still offer categories.
        await db.exec('ALTER TABLE categories DROP COLUMN icon_key');
        const minimalResponse=await fetch(`http://127.0.0.1:${server.address().port}/categories`);
        const minimal=await minimalResponse.json();
        assert.equal(minimalResponse.status,200);assert.equal(minimal.count,body.count);
        assert.ok(minimal.items.every(x=>x.iconKey===null));
    } finally {
        if(server)await new Promise(resolve=>server.close(resolve));
        await db.close();
    }
});

test('six-category migration preserves live events, review payloads, and original request snapshots', async () => {
    const db = new PGlite();
    let server;
    const migration = filename => fs.readFileSync(path.join(__dirname, '../db/migrations', filename), 'utf8');
    const rows = async (sql, params) => (await db.query(sql, params)).rows;
    const names = ['Arts', 'Entertainment', 'Family', 'Fitness', 'Food', 'Other'];
    try {
        await db.waitReady;
        for (const file of ['initial_schema.sql', '002_event_submissions.sql', '004_event_reports.sql',
            '005_venue_lookup.sql', '006_lightweight_calendar.sql', '008_admin_management.sql', '009_feed_changes.sql']) {
            await db.exec(migration(file));
        }
        const legacy = Object.fromEntries((await rows(`INSERT INTO categories(name,slug) VALUES
            ('Food','hyena-seed-food'),('Games','games'),('Music','music'),('Outdoors','outdoors'),
            ('Sports','sports'),('Community','community') RETURNING slug,id`)).map(row => [row.slug,row.id]));
        legacy.other = (await rows("SELECT id FROM categories WHERE slug = 'other'"))[0].id;
        const [venue] = await rows("INSERT INTO businesses(name,city,state) VALUES ('Studio','Rexburg','ID') RETURNING id");
        const [event] = await rows("INSERT INTO experiences(business_id,title) VALUES ($1,'Keep this event') RETURNING id",[venue.id]);
        await db.query("INSERT INTO experience_schedules(experience_id,kind,start_date,start_time,end_time) VALUES ($1,'ONCE','2030-04-04','18:00','20:00')",[event.id]);
        await db.query('INSERT INTO experience_categories SELECT $1,unnest($2::uuid[])',
            [event.id,[legacy.games,legacy.music,legacy.outdoors,legacy.sports,legacy['hyena-seed-food']]]);
        const snapshot = {venue:{businessId:venue.id},event:{title:'Pending event',categoryIds:[legacy.games,legacy.music,legacy.community],schedule:{timeZone:'America/Denver'}}};
        const [submission] = await rows(`INSERT INTO event_submissions(id,client_request_id,payload,request_payload)
            VALUES (gen_random_uuid(),gen_random_uuid(),$1,$1) RETURNING id, client_request_id`,[JSON.stringify(snapshot)]);
        await db.exec(migration('010_simplify_categories.sql'));
        await db.exec(fs.readFileSync(path.join(__dirname, '../db/seeds/sample_data.sql'), 'utf8'));

        const app = express();
        app.use('/categories',createCategoryRouter({pool:db}));
        server = await new Promise(resolve => {const listener = app.listen(0,'127.0.0.1',() => resolve(listener));});
        const response = await fetch(`http://127.0.0.1:${server.address().port}/categories`);
        assert.equal(response.status, 200);
        const {items} = await response.json();
        assert.deepEqual(items.map(item => item.name), names);
        const ids = Object.fromEntries(items.map(item => [item.slug,item.id]));
        assert.equal(ids.food, legacy['hyena-seed-food']);
        assert.equal(ids.other, legacy.other);
        assert.deepEqual(await rows('SELECT id,title FROM experiences'),[{id:event.id,title:'Keep this event'}]);
        assert.equal((await rows('SELECT COUNT(*)::int AS n FROM experience_schedules'))[0].n,1);
        assert.deepEqual((await rows(`SELECT c.name FROM experience_categories ec JOIN categories c ON ec.category_id=c.id
            WHERE ec.experience_id=$1 ORDER BY c.name`,[event.id])).map(r=>r.name),['Entertainment','Fitness','Food']);
        const [pending] = await rows('SELECT payload,request_payload,revision FROM event_submissions WHERE id=$1',[submission.id]);
        assert.deepEqual(pending.request_payload, snapshot);
        assert.deepEqual(pending.payload.event.categoryIds, [ids.entertainment,ids.other].sort());
        assert.equal(pending.revision,1);
        const retry = await submitEvent(db,{clientRequestId:submission.client_request_id,payload:snapshot},new Date());
        assert.equal(retry.created,false);
        assert.equal(retry.item.id,submission.id);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});
