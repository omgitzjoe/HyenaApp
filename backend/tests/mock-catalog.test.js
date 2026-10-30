const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {discoverExperiences}=require('../services/discovery');
const read=p=>fs.readFileSync(path.join(__dirname,'../db',p),'utf8');
test('realistic mock catalog covers categories, filters, safe refresh and legacy constraints',async()=>{
    const db=new PGlite();
    try{
        await db.waitReady;await db.exec(read('migrations/initial_schema.sql'));await db.exec(read('seeds/sample_data.sql'));
        const now=new Date();
        const categories=(await db.query('SELECT id,name FROM categories')).rows;
        assert.equal(categories.length,16);
        const rows=(await db.query('SELECT title,description FROM experiences')).rows;
        assert.equal(rows.length,225);assert.ok(rows.every(x=>!/^Seed /i.test(x.title)));
        assert.ok(rows.every(x=>x.description.includes('Mock listing')));
        for(const {id,name} of categories){
            const q={latitude:'43.8231',longitude:'-111.7924',radiusMiles:'100',categoryId:id,window:'today',timeZone:'America/Denver',limit:'100'};
            assert.ok((await discoverExperiences(db,q,now)).count>0,name+' Today');
            assert.ok((await discoverExperiences(db,{...q,window:'now'},now)).count>0,name+' Now');
            assert.ok((await discoverExperiences(db,{...q,price:'free'},now)).count>0,name+' Free');
            assert.ok((await discoverExperiences(db,{...q,window:'all',price:'max',maxPrice:'10',currency:'USD'},now)).count>0,name+' Maximum price');
            const unknown=await db.query(`SELECT count(*)::int AS n FROM experiences e JOIN experience_categories ec ON ec.experience_id=e.id WHERE ec.category_id=$1 AND e.price_amount IS NULL`,[id]);
            assert.ok(unknown.rows[0].n>0,name+' unknown price');
        }
        await db.exec(read('tests/constraints_test.sql'));
        const usersBefore=(await db.query('SELECT id,email,password_hash FROM users ORDER BY id')).rows;
        await db.query("INSERT INTO categories(name,slug) VALUES ('Custom unrelated category','custom-unrelated')");
        await db.query("UPDATE categories SET name='Previous mock Food' WHERE name='Food'");
        const customFood=(await db.query("INSERT INTO categories(name,slug) VALUES ('Food','custom-food') RETURNING id")).rows[0].id;
        await db.exec(read('seeds/refresh_mock_catalog.sql'));await db.exec(read('seeds/refresh_mock_catalog.sql'));
        assert.equal((await db.query('SELECT name FROM categories WHERE id=$1',[customFood])).rows[0].name,'Food');
        assert.equal((await db.query("SELECT name FROM categories WHERE slug='hyena-seed-food'")).rows[0].name,'Food (Demo)');
        assert.equal((await db.query('SELECT count(*)::int AS n FROM experiences')).rows[0].n,225);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM categories WHERE slug='custom-unrelated'")).rows[0].n,1);
        assert.deepEqual((await db.query('SELECT id,email,password_hash FROM users ORDER BY id')).rows,usersBefore);
    }finally{await db.close();}
});
