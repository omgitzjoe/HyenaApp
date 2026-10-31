const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const {PGlite}=require('@electric-sql/pglite');
const createSubmissionRouter=require('../routes/submissions');
const createBusinessRouter=require('../routes/businesses');
const createExperienceRouter=require('../routes/experiences');
const {createAdminRouter}=require('../routes/admin');
const {hashPassword,verifyPassword}=require('../services/adminPasswords');
const {parseSubmission}=require('../validation/submission');
const {reviewSubmission}=require('../services/submissions');
const {requestLimit}=require('../middleware/requestLimits');
let db,pool,server,base,env,session,curatorKey;
const ids={};const now=()=>new Date();const quiet={error(){},warn(){}};
const pass='test-only-long-password';const skip=(req,res,next)=>next();
function event(venue={businessId:ids.business}){
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 return {clientRequestId:randomUUID(),venue,event:{title:'Community art evening',description:'A friendly workshop for neighbors.',type:'EVENT',priceAmount:'5.00',currency:'USD',categoryIds:[ids.category],schedule:{kind:'ONCE',startDate:date,endDate:date,startTime:'18:00',endTime:'20:00',endsNextDay:false,timeZone:'America/Denver',weekdays:[]}}};
}
async function request(route,body,auth=false,extra={}){
 const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,...(auth?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json(),headers:response.headers};
}
async function submit(body=event()){const r=await request('/api/v1/submissions',body);assert.equal(r.status,201,JSON.stringify(r.body));return r.body.item;}
before(async()=>{
 db=new PGlite();await db.waitReady;
 for(const f of ['initial_schema.sql','002_event_submissions.sql','004_event_reports.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations',f),'utf8'));
 // Apply twice to ensure the migration is repeat-safe.
 await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations/002_event_submissions.sql'),'utf8'));
 ids.area=randomUUID();ids.business=randomUUID();ids.category=randomUUID();ids.closed=randomUUID();
 await db.query("INSERT INTO businesses(id,name,address,city,is_active,latitude,longitude) VALUES ($1,'Open Studio','1 Test St','Rexburg',TRUE,43.8231,-111.7924),($2,'Closed Studio','2 Test St','Rexburg',FALSE,43.8231,-111.7924)",[ids.business,ids.closed]);
 await db.query("INSERT INTO categories(id,name,slug) VALUES ($1,'Arts','arts')",[ids.category]);
 let lock=Promise.resolve();
 pool={query:(...args)=>db.query(...args),async connect(){let release;const old=lock;lock=new Promise(r=>release=r);await old;return {query:(...args)=>db.query(...args),release};}};
 env={ADMIN_USERNAME:'reviewer',ADMIN_PASSWORD_HASH:await hashPassword(pass),NODE_ENV:'test'};
 curatorKey=require('node:crypto').randomBytes(32).toString('hex');process.env.CURATOR_API_KEY=curatorKey;
 const poolModule=require.resolve('../db');require.cache[poolModule]={id:poolModule,filename:poolModule,loaded:true,exports:pool};
 const app=express();app.use(express.json({limit:'64kb'}));
 app.use('/api/v1/experiences',createExperienceRouter({pool,logger:quiet}));
 app.use('/api/v1/curator',require('../routes/curator'));
 app.use('/api/v1/submissions',createSubmissionRouter({pool,logger:quiet,limiter:skip}));
 app.use('/limited',createSubmissionRouter({pool,logger:quiet,limiter:requestLimit(1,60000)}));
 app.use('/api/v1/reports',require('../routes/reports').createReportRouter({pool,logger:quiet,limiter:skip}));
 app.use('/limited-reports',require('../routes/reports').createReportRouter({pool,logger:quiet,limiter:requestLimit(1,60000)}));
 app.use('/api/v1/businesses',createBusinessRouter({pool,logger:quiet}));
 app.use('/admin',createAdminRouter({pool,env,logger:quiet,loginLimiter:skip}));
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
 const login=await request('/admin/api/login',{username:'reviewer',password:pass});assert.equal(login.status,200);
 session={cookie:login.headers.get('set-cookie').split(';')[0],csrf:login.body.csrfToken};
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
test('valid submissions are pending and never create public experiences',async()=>{
 const before=(await db.query('SELECT count(*)::int AS n FROM experiences')).rows[0].n;
 const item=await submit();assert.equal(item.status,'PENDING');
 assert.equal((await request('/api/v1/experiences?window=all&latitude=43.8231&longitude=-111.7924&radiusMiles=100')).body.count,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM experiences')).rows[0].n,before);
});
test('identical retries are idempotent and conflicting request reuse returns 409',async()=>{
 const body=event();const first=await submit(body);const second=await request('/api/v1/submissions',body);
 assert.equal(second.status,200);assert.equal(second.body.item.id,first.id);
 body.event.title='Different event';assert.equal((await request('/api/v1/submissions',body)).status,409);
});
test('concurrent retries create one submission',async()=>{
 const body=event();const result=await Promise.all([request('/api/v1/submissions',body),request('/api/v1/submissions',body)]);
 assert.deepEqual(result.map(x=>x.status).sort(),[200,201]);assert.equal(result[0].body.item.id,result[1].body.item.id);
});
test('field validation rejects invalid dates, weekly events, currency, duplicates and spoofed status',()=>{
 const mutations=[b=>b.event.title=' ',b=>b.event.schedule.startDate='2030-02-30',b=>b.event.schedule.kind='WEEKLY',b=>b.event.currency='EUR',b=>b.event.categoryIds.push(ids.category),b=>b.status='APPROVED',b=>b.event.businessId=ids.business,b=>b.venue.proposal={name:'bad'}];
 for(const mutate of mutations){const body=event();mutate(body);assert.equal(parseSubmission(body).success,false,JSON.stringify(body));}
});
test('unknown price is accepted and numeric zero is free',async()=>{
 for(const amount of [null,'0']){const body=event();body.event.priceAmount=amount;body.event.currency=amount===null?null:'USD';await submit(body);}
});
test('public endpoint rejects expired events, invalid references and inactive venues',async()=>{
 const past=event();past.event.schedule.startDate=past.event.schedule.endDate='2020-01-01';assert.equal((await request('/api/v1/submissions',past)).status,400);
 const closed=event({businessId:ids.closed});assert.equal((await request('/api/v1/submissions',closed)).status,400);
 const bad=event();bad.event.categoryIds=[randomUUID()];assert.equal((await request('/api/v1/submissions',bad)).status,400);
});
test('overnight one-time event can be submitted',async()=>{const body=event();body.event.schedule.startTime='23:00';body.event.schedule.endTime='01:00';body.event.schedule.endsNextDay=true;await submit(body);});
test('public submission throttling returns 429',async()=>{assert.equal((await request('/limited',event())).status,201);assert.equal((await request('/limited',event())).status,429);});
test('venue search orders located active venues and rejects incomplete coordinates',async()=>{
 const r=await request('/api/v1/businesses?latitude=43.8231&longitude=-111.7924');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].timeZone,'America/Boise');
 assert.equal((await request('/api/v1/businesses?latitude=43')).status,400);
 assert.equal((await request('/api/v1/businesses?searchAll=true&q='+encodeURIComponent('%'))).body.items.length,0);
});
test('queue requires sign-in; wrong password and wrong-origin login are rejected',async()=>{
 assert.equal((await request('/admin/api/submissions')).status,401);
 assert.equal((await request('/admin/api/login',{username:'reviewer',password:'incorrect'})).status,401);
 assert.equal((await request('/admin/api/login',{username:'reviewer',password:pass},false,{Origin:'https://evil.invalid'})).status,403);
});
test('session cookie is HttpOnly, scoped and same-site; database never stores raw cookie token',async()=>{
 const r=await request('/admin/api/login',{username:'reviewer',password:pass});const cookie=r.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);assert.match(cookie,/Path=\/admin/);
 const token=cookie.split(';')[0].split('=')[1];assert.equal((await db.query('SELECT count(*)::int AS n FROM admin_sessions WHERE token_hash=$1',[token])).rows[0].n,0);
});
test('dashboard assets have CSP and no-store headers without leaking curator keys',async()=>{
 const r=await fetch(base+'/admin/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!(await r.text()).includes('CURATOR_API_KEY'));
});
test('review list includes pending payload and business context',async()=>{
 const r=await request('/admin/api/submissions',undefined,true);assert.equal(r.status,200);assert.ok(r.body.items.length>0);assert.equal(r.body.items[0].business.name,'Open Studio');
 assert.equal((await request('/admin/api/submissions?status=HIDDEN',undefined,true)).status,400);
});
test('approval requires CSRF and publishes a full experience exactly once',async()=>{
 const item=await submit();assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{},false,{Cookie:session.cookie})).status,403);
 const r=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.item.status,'APPROVED');
 assert.equal((await request('/api/v1/experiences/'+r.body.item.experienceId)).status,200);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM experience_schedules WHERE experience_id=$1',[r.body.item.experienceId])).rows[0].n,1);
 const retry=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(retry.body.item.experienceId,r.body.item.experienceId);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/reject',{note:'Too late'},true)).status,409);
});
test('concurrent approvals are idempotent under transaction serialization',async()=>{
 const item=await submit();const r=await Promise.all([reviewSubmission(pool,item.id,'APPROVED','reviewer'),reviewSubmission(pool,item.id,'APPROVED','reviewer')]);assert.equal(r[0].experienceId,r[1].experienceId);
});
test('rejection needs a reason, does not publish, and cannot later be approved',async()=>{
 const item=await submit();assert.equal((await request('/admin/api/submissions/'+item.id+'/reject',{note:' '},true)).status,400);
 const r=await request('/admin/api/submissions/'+item.id+'/reject',{note:'Venue details could not be verified.'},true);assert.equal(r.status,200);assert.equal(r.body.item.experienceId,null);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{},true)).status,409);
});
test('approval creates a proposed venue with coordinates atomically',async()=>{
 const item=await submit(event({proposal:{latitude:43.8231,longitude:-111.7924,name:'New Workshop Room',address:'10 Workshop Lane',city:'Rexburg'}}));
 const r=await request('/admin/api/submissions/'+item.id+'/approve',{latitude:43.8231,longitude:-111.7924},true);assert.equal(r.status,200);
 const venue=(await db.query('SELECT b.* FROM businesses b JOIN experiences e ON e.business_id=b.id WHERE e.id=$1',[r.body.item.experienceId])).rows[0];assert.equal(venue.name,'New Workshop Room');assert.equal(Number(venue.latitude),43.8231);
});
test('approval can match a proposed venue to an existing venue',async()=>{
 const item=await submit(event({proposal:{latitude:43.8231,longitude:-111.7924,name:'Open Studio alternate name',address:'1 Test St',city:'Rexburg'}}));
 const before=(await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n;
 const r=await request('/admin/api/submissions/'+item.id+'/approve',{businessId:ids.business},true);assert.equal(r.status,200);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n,before);
});
test('invalid categories at approval roll back proposed venue creation',async()=>{
 const category=randomUUID();await db.query("INSERT INTO categories(id,name,slug) VALUES ($1,'Temporary','temporary')",[category]);
 const body=event({proposal:{latitude:43.8231,longitude:-111.7924,name:'Must roll back',address:'11 Workshop Lane',city:'Rexburg'}});body.event.categoryIds=[category];const item=await submit(body);
 await db.query('DELETE FROM categories WHERE id=$1',[category]);
 const r=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(r.status,400);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM businesses WHERE name='Must roll back'")).rows[0].n,0);
 assert.equal((await db.query('SELECT status FROM event_submissions WHERE id=$1',[item.id])).rows[0].status,'PENDING');
});
test('events ending before review cannot be published',async()=>{
 const item=await submit();await assert.rejects(()=>reviewSubmission(pool,item.id,'APPROVED','reviewer',{},new Date('2040-01-01T00:00:00Z')),e=>e.code==='EVENT_ENDED');
});
test('rotating admin credentials invalidates existing sessions; logout revokes session',async()=>{
 const old=env.ADMIN_PASSWORD_HASH;env.ADMIN_PASSWORD_HASH=await hashPassword('a-different-test-password');assert.equal((await request('/admin/api/session',undefined,true)).status,401);env.ADMIN_PASSWORD_HASH=old;
 assert.equal((await request('/admin/api/logout',{},true)).status,200);assert.equal((await request('/admin/api/session',undefined,true)).status,401);
 assert.ok(await verifyPassword(pass,env.ADMIN_PASSWORD_HASH));assert.equal(await verifyPassword('wrong',env.ADMIN_PASSWORD_HASH),false);
});

test('expired sessions are denied and restored sessions can page through microsecond timestamps',async()=>{
 const login=await request('/admin/api/login',{username:'reviewer',password:pass});session={cookie:login.headers.get('set-cookie').split(';')[0],csrf:login.body.csrfToken};
 const expired=randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,'');
 const {hashToken}=require('../services/adminPasswords');
 await db.query(`INSERT INTO admin_sessions(token_hash,username,credential_version,csrf_token,expires_at) VALUES($1,$2,$3,'csrf','2020-01-01')`,[hashToken(expired),'reviewer',hashToken(env.ADMIN_PASSWORD_HASH)]);
 assert.equal((await request('/admin/api/session',undefined,false,{Cookie:'hyena_admin='+expired})).status,401);
 const payload=parseSubmission(event()).data.payload;
 for(let n=0;n<55;n++)await db.query(`INSERT INTO event_submissions(id,client_request_id,payload,created_at) VALUES ($1,$2,$3::jsonb,$4)`,[randomUUID(),randomUUID(),JSON.stringify(payload),'2026-01-01T12:00:00.000'+String(100+n)+'Z']);
 const expected=(await db.query("SELECT count(*)::int AS n FROM event_submissions WHERE status='PENDING'")).rows[0].n;
 let cursor=null,seen=[];
 do{const r=await request('/admin/api/submissions'+(cursor?'?before='+cursor:''),undefined,true);assert.equal(r.status,200);seen.push(...r.body.items.map(x=>x.id));cursor=r.body.nextCursor;}while(cursor);
 assert.equal(seen.length,expected);assert.equal(new Set(seen).size,expected);
});
test('wrong-origin approvals are rejected even with a valid session and CSRF',async()=>{
 const item=await submit();assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{},true,{Origin:'https://evil.invalid'})).status,403);
});
test('public retries after approval return their receipt without republishing',async()=>{
 const body=event();const item=await submit(body);const approved=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(approved.status,200);
 const retried=await request('/api/v1/submissions',body);assert.equal(retried.status,200);assert.equal(retried.body.item.status,'APPROVED');assert.equal(retried.body.item.id,item.id);
});
test('invalid coordinates and inactive venue at approval are rejected without partial publication',async()=>{
 const item=await submit();assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{latitude:99,longitude:0},true)).status,400);
 try{await db.query('UPDATE businesses SET is_active=FALSE WHERE id=$1',[ids.business]);assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{},true)).status,400);}
 finally{await db.query('UPDATE businesses SET is_active=TRUE WHERE id=$1',[ids.business]);}
 assert.equal((await db.query('SELECT status FROM event_submissions WHERE id=$1',[item.id])).rows[0].status,'PENDING');
});
test('schema prevents approved or rejected rows without review ownership and required result',async()=>{
 const item=await submit();
 for(const sql of ["UPDATE event_submissions SET status='APPROVED' WHERE id=$1","UPDATE event_submissions SET status='REJECTED',reviewed_at=CURRENT_TIMESTAMP,review_note='No' WHERE id=$1"]){await assert.rejects(()=>db.query(sql,[item.id]),error=>error.code==='23514');}
});
test('administrator login rate limit and disabled/HTTP-production configurations fail closed',async()=>{
 const app=express();app.set('trust proxy',1);app.use(express.json());app.use('/admin',createAdminRouter({pool,env,logger:quiet,loginLimiter:requestLimit(1,60000)}));
 app.use('/disabled',createAdminRouter({pool,env:{},logger:quiet}));app.use('/production',createAdminRouter({pool,env:{...env,NODE_ENV:'production'},logger:quiet}));
 const local=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin='http://127.0.0.1:'+local.address().port;
 try{
  for(const expected of [401,429]){const r=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'reviewer',password:'wrong'})});assert.equal(r.status,expected);}
  assert.equal((await fetch(origin+'/disabled/api/session')).status,503);
  assert.equal((await fetch(origin+'/production/api/session')).status,400);
  const secure=await fetch(origin+'/production/api/login',{method:'POST',headers:{Origin:origin.replace('http:','https:'),'X-Forwarded-Proto':'https','Content-Type':'application/json'},body:JSON.stringify({username:'reviewer',password:pass})});
  assert.equal(secure.status,200);assert.match(secure.headers.get('set-cookie'),/; Secure/i);
 }finally{await new Promise(r=>local.close(r));}
});

test('existing curator creation still requires its key and uses the same publisher',async()=>{
 const body={...event().event,businessId:ids.business};
 assert.equal((await request('/api/v1/curator/experiences',body)).status,401);
 const result=await request('/api/v1/curator/experiences',body,false,{Authorization:'Bearer '+curatorKey});assert.equal(result.status,201,JSON.stringify(result.body));
 assert.equal((await request('/api/v1/experiences/'+result.body.item.id)).status,200);
 const invalid={...body,businessId:ids.closed};
 assert.equal((await request('/api/v1/curator/experiences',invalid,false,{Authorization:'Bearer '+curatorKey})).status,400);
});

test('new venue coordinates derive the zone; All Day normalizes times and publishes all category links',async()=>{
 const second=randomUUID();await db.query("INSERT INTO categories(id,name,slug) VALUES ($1,'Community','community-location-test')",[second]);
 const body=event({proposal:{latitude:40.7128,longitude:-74.006,name:'New York Workshop',address:'5 Mock Lane',city:'New York'}});
 body.event.categoryIds.push(second);body.event.schedule.timeZone='Asia/Tokyo';body.event.schedule.allDay=true;
 body.event.schedule.startTime='19:00';body.event.schedule.endTime='01:00';body.event.schedule.endsNextDay=true;
 const item=await submit(body);
 const pending=(await db.query('SELECT payload FROM event_submissions WHERE id=$1',[item.id])).rows[0].payload;
 assert.equal(pending.event.schedule.timeZone,'America/New_York');assert.equal(pending.event.schedule.startTime,'00:00:00');assert.equal(pending.event.schedule.endTime,'23:59:00');assert.equal(pending.event.schedule.endsNextDay,false);
 const approved=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(approved.status,200,JSON.stringify(approved.body));
 const schedule=(await db.query('SELECT * FROM experience_schedules WHERE experience_id=$1',[approved.body.item.experienceId])).rows[0];
 assert.equal(schedule.all_day,true);assert.equal(schedule.time_zone,'America/New_York');assert.equal(schedule.end_time,'23:59:00');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM experience_categories WHERE experience_id=$1',[approved.body.item.experienceId])).rows[0].n,2);
});

test('new venue needs coordinates and submission schedules may omit timeZone',async()=>{
 const body=event();delete body.event.schedule.timeZone;
 const result=await submit(body);assert.equal(result.status,'PENDING');
 const bad=event({proposal:{name:'Missing location',address:'1 Main',city:'Rexburg'}});
 assert.equal((await request('/api/v1/submissions',bad)).status,400);
 for (const coordinates of [{latitude:91,longitude:0},{latitude:0,longitude:-181}]) {
  bad.venue.proposal={...bad.venue.proposal,...coordinates};assert.equal((await request('/api/v1/submissions',bad)).status,400);
 }
});

test('legacy queued venues need a verified location before approval and can supply it in review',async()=>{
 const body=event({proposal:{latitude:43.8231,longitude:-111.7924,name:'Legacy queued studio',address:'10 Main',city:'Rexburg'}});
 const item=await submit(body);
 await db.query("UPDATE event_submissions SET payload=payload #- '{venue,proposal,latitude}' #- '{venue,proposal,longitude}' WHERE id=$1",[item.id]);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{},true)).status,400);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{latitude:43.8231,longitude:-111.7924},true)).status,200);
});

test('venue suggestions filter radius before limiting and Search all includes distant matches',async()=>{
 const venues=[];
 try {
  for (const [name,latitude,longitude] of [['Radius venue close',43.8231,-111.7924],['Radius venue far',40.7128,-74.006]]) {
   const id=randomUUID();venues.push(id);
   await db.query("INSERT INTO businesses(id,name,address,city,latitude,longitude) VALUES ($1,$2,'Unique searchable street','Rexburg',$3,$4)",[id,name,latitude,longitude]);
  }
  const base='/api/v1/businesses?latitude=43.8231&longitude=-111.7924&radiusMiles=5&q=Radius';
  const local=await request(base);assert.equal(local.status,200);assert.deepEqual(local.body.items.map(x=>x.name),['Radius venue close']);
  const all=await request(base+'&searchAll=true');assert.equal(all.status,200);assert.equal(all.body.items.length,2);assert.ok(all.body.items[1].distanceMiles>5);
  const address=await request('/api/v1/businesses?searchAll=true&q=Unique%20searchable');assert.equal(address.status,200);assert.equal(address.body.items.length,2);
  for(const query of ['?q=Radius','?latitude=43&longitude=-111&radiusMiles=0','?latitude=43&longitude=-111&radiusMiles=101','?searchAll=invalid'])assert.equal((await request('/api/v1/businesses'+query)).status,400);
 } finally {for(const id of venues)await db.query('DELETE FROM businesses WHERE id=$1',[id]);}
});

test('nearby venue suggestions apply the radius before the 50-venue response cap',async()=>{
 const venues=[];
 try {
  for(let n=0;n<52;n++){
   const id=randomUUID();venues.push(id);
   await db.query("INSERT INTO businesses(id,name,address,city,latitude,longitude) VALUES ($1,$2,'1 Limit Lane','Fixture',40.7128,-74.006)",[id,'Cap test A far '+n]);
  }
  const close=randomUUID();venues.push(close);
  await db.query("INSERT INTO businesses(id,name,address,city,latitude,longitude) VALUES ($1,'Cap test Z nearby','2 Limit Lane','Fixture',43.8231,-111.7924)",[close]);
  const r=await request('/api/v1/businesses?latitude=43.8231&longitude=-111.7924&radiusMiles=5&q=Cap%20test');
  assert.equal(r.status,200);assert.deepEqual(r.body.items.map(x=>x.id),[close]);assert.equal(r.body.hasMore,false);
 }finally{for(const id of venues)await db.query('DELETE FROM businesses WHERE id=$1',[id]);}
});

test('community corrections validate input and require authenticated CSRF-protected review',async()=>{
 const submission=await submit();
 assert.equal((await request('/admin/api/submissions/'+submission.id+'/approve',{},true)).status,200);
 const id=(await db.query('SELECT published_experience_id AS id FROM event_submissions WHERE id=$1',[submission.id])).rows[0].id;
 assert.equal((await request('/api/v1/reports',{experienceId:id,reason:'WRONG_TIME',details:'x'.repeat(1001)})).status,400);
 assert.equal((await request('/api/v1/reports',{experienceId:randomUUID(),reason:'OTHER'})).status,404);
 assert.equal((await request('/api/v1/reports',{experienceId:id,reason:'BAD'})).status,400);
 const report=await request('/api/v1/reports',{experienceId:id,reason:'WRONG_TIME',details:'Time changed to 7 PM.'});assert.equal(report.status,201);
 assert.equal((await db.query('SELECT is_active FROM experiences WHERE id=$1',[id])).rows[0].is_active,true);
 assert.equal((await request('/admin/api/reports')).status,401);
 const queue=await request('/admin/api/reports',undefined,true);assert.equal(queue.status,200);assert.ok(queue.body.items.some(x=>x.id===report.body.id));
 assert.equal((await request('/admin/api/reports/'+report.body.id+'/resolve',{},false,{Cookie:session.cookie})).status,403);
 assert.equal((await request('/admin/api/reports/'+report.body.id+'/resolve',{},true)).status,200);
 assert.equal((await request('/admin/api/reports/'+report.body.id+'/resolve',{},true)).status,404);
 assert.ok(!(await request('/admin/api/reports',undefined,true)).body.items.some(x=>x.id===report.body.id));
 assert.equal((await request('/limited-reports',{experienceId:id,reason:'OTHER'})).status,201);
 assert.equal((await request('/limited-reports',{experienceId:id,reason:'OTHER'})).status,429);
});
