const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=p=>fs.readFileSync(path.join(__dirname,'../db',p),'utf8');
test('lightweight migration removes the explicit fictional catalog and user tables, preserving categories and real events',async()=>{
 const db=new PGlite();
 try{
  await db.waitReady;await db.exec(read('migrations/initial_schema.sql'));await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/legacy_sample_data.sql'),'utf8'));
  for(const f of ['002_event_submissions.sql','004_event_reports.sql','005_venue_lookup.sql'])await db.exec(read('migrations/'+f));
  const venue=(await db.query("INSERT INTO businesses(name,address,city,region,latitude,longitude) VALUES('Real community venue','1 Main','Rexburg','ID',43.8,-111.8) RETURNING id")).rows[0].id;
  const event=(await db.query("INSERT INTO experiences(business_id,title,description,type) VALUES($1,'Real event','Source description','EVENT') RETURNING id",[venue])).rows[0].id;
  await db.exec(read('migrations/006_lightweight_calendar.sql'));
  assert.deepEqual((await db.query('SELECT id FROM experiences')).rows.map(x=>x.id),[event]);
  assert.deepEqual((await db.query('SELECT id FROM businesses')).rows.map(x=>x.id),[venue]);
  assert.ok((await db.query('SELECT count(*)::int AS n FROM categories')).rows[0].n>=16);
  for(const name of ['users','sessions','saved_experiences'])assert.equal((await db.query('SELECT to_regclass($1) AS name',[name])).rows[0].name,null);
 }finally{await db.close();}
});
