const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const createCategoryRouter = require('../routes/categories');

test('checked-in schema and full seed expose category choices through HTTP', async () => {
    const db = new PGlite();
    let server;
    try {
        await db.waitReady;
        await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations/initial_schema.sql'),'utf8'));
        await db.exec(fs.readFileSync(path.join(__dirname,'../db/seeds/sample_data.sql'),'utf8'));
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
