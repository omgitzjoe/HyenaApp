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

test('verified test cleanup removes only matching test IDs and their review records',async()=>{
 const db=new PGlite();
 try{
  await db.waitReady;
  for(const f of ['initial_schema.sql','002_event_submissions.sql','004_event_reports.sql','005_venue_lookup.sql','006_lightweight_calendar.sql'])await db.exec(read('migrations/'+f));
  await db.exec(`INSERT INTO businesses(id,name,city,state) VALUES
   ('e766f983-a47d-4e19-9f83-7da9292c4459','Location workflow test studio','Rexburg','ID'),
   ('00000000-0000-4000-8000-000000000091','Real venue','Rexburg','ID');
   INSERT INTO experiences(id,business_id,title) VALUES
   ('85395e8d-3f49-493a-af24-724c6b9e6313','e766f983-a47d-4e19-9f83-7da9292c4459','Location workflow verification — reject after review'),
   ('d38acba1-bc40-41d4-9a8e-adf26b26a38d','00000000-0000-4000-8000-000000000091','test'),
   ('00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000091','Real community event');
   INSERT INTO event_submissions(id,client_request_id,payload,status,published_experience_id,reviewed_by,reviewed_at)
   VALUES(gen_random_uuid(),gen_random_uuid(),'{}','APPROVED','85395e8d-3f49-493a-af24-724c6b9e6313','test reviewer',CURRENT_TIMESTAMP);`);
  await db.exec(read('migrations/007_verified_test_cleanup.sql'));
  assert.deepEqual((await db.query('SELECT title FROM experiences')).rows.map(x=>x.title),['Real community event']);
  assert.deepEqual((await db.query('SELECT name FROM businesses')).rows.map(x=>x.name),['Real venue']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM event_submissions')).rows[0].n,0);
 }finally{await db.close();}
});

test('admin migration retires exact existing duplicates and removes review notes',async()=>{
 const db=new PGlite();
 try{
  await db.waitReady;for(const f of ['initial_schema.sql','002_event_submissions.sql','004_event_reports.sql','005_venue_lookup.sql','006_lightweight_calendar.sql'])await db.exec(read('migrations/'+f));
  const venue=(await db.query("INSERT INTO businesses(name,city,state) VALUES('Library','Rexburg','ID') RETURNING id")).rows[0].id;
  for(let i=0;i<3;i++){
   const id=(await db.query("INSERT INTO experiences(business_id,title) VALUES($1,'Same community event') RETURNING id",[venue])).rows[0].id;
   await db.query("INSERT INTO experience_schedules(experience_id,kind,start_date,start_time,end_time) VALUES($1,'ONCE','2030-05-01',$2,'21:00')",[id,i===2?'20:00':'19:00']);
   await db.query("INSERT INTO event_submissions(id,client_request_id,payload,status,published_experience_id,reviewed_by,reviewed_at) VALUES(gen_random_uuid(),gen_random_uuid(),'{}','APPROVED',$1,'curator',CURRENT_TIMESTAMP)",[id]);
  }
  await db.exec(read('migrations/008_admin_management.sql'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM experiences WHERE is_active')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM event_submissions WHERE duplicate_of IS NOT NULL')).rows[0].n,1);
  assert.equal((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='event_submissions' AND column_name='review_note'")).rows.length,0);
 }finally{await db.close();}
});
