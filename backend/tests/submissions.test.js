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
 return {clientRequestId:randomUUID(),venue,event:{title:'Community art evening '+randomUUID().slice(0,8),description:'A friendly workshop for neighbors.',type:'EVENT',priceAmount:'5.00',currency:'USD',categoryIds:[ids.category],schedule:{kind:'ONCE',startDate:date,endDate:date,startTime:'18:00',endTime:'20:00',endsNextDay:false,timeZone:'America/Denver',weekdays:[]}}};
}
async function request(route,body,auth=false,extra={}){
 const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,...(auth?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json(),headers:response.headers};
}
async function submit(body=event()){const r=await request('/api/v1/submissions',body);assert.equal(r.status,201,JSON.stringify(r.body));return r.body.item;}
before(async()=>{
 db=new PGlite();await db.waitReady;
 for(const f of ['initial_schema.sql','002_event_submissions.sql','004_event_reports.sql','005_venue_lookup.sql','006_lightweight_calendar.sql','008_admin_management.sql','009_feed_changes.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations',f),'utf8'));

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
 const importFetcher = async url => {
  if (url.includes('ifpl.org')) return Response.json({events:[],total_pages:1});
  if (!url.includes('idahofallsidaho.gov') && !url.includes('thrillshare')) {
   return new Response('Unavailable', {status:503});
  }
  if (url.includes('idahofallsidaho.gov')) {
   return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n');
  }
  const start = new Date(Date.now() + 2*86400000);
  start.setUTCHours(18, 0, 0, 0);
  return Response.json({events:[{
   id:51, title:'Community lantern walk', venue:'Open Studio',
   start_at:start.toISOString(), end_at:new Date(start.getTime()+3600000).toISOString()
  }, {
   id:52, title:'City Hall Closed', filter_name:['Closure'],
   start_at:start.toISOString(), end_at:new Date(start.getTime()+3600000).toISOString()
  }, ...['Christmas Day', 'Christmas Concert', 'Winter craft fair'].map((title, index) => ({
   id:53+index, title, venue:'100 Main St, Rexburg, ID', latitude:43.8231, longitude:-111.7924,
   start_at:start.toISOString(), end_at:new Date(start.getTime()+3600000).toISOString()
  }))]});
 };
 const venueLookup={
  search:async()=>[{name:'Open Studio',address:'1 Test St',city:'Rexburg',latitude:43.8231,longitude:-111.7924,label:'Open Studio, 1 Test St, Rexburg'}],
  resolve:async input => input.address==='1 Test St' ? {...input,latitude:43.8231,longitude:-111.7924} : null,
  venue:async venue => venue.proposal && venue.proposal.latitude == null ? {
   proposal:{...venue.proposal,latitude:43.8231,longitude:-111.7924}
  } : venue
 };
 app.use('/admin',createAdminRouter({pool,env,logger:quiet,loginLimiter:skip,importFetcher,venueLookup}));
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
 const mutations=[b=>b.event.title=' ',b=>b.event.schedule.startDate='2030-02-30',b=>b.event.schedule.kind='MONTHLY',b=>b.event.categoryIds.push(ids.category),b=>b.status='APPROVED',b=>b.event.businessId=ids.business,b=>b.venue.proposal={name:'bad'}];
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
test('rejection needs no note, does not publish, and cannot later be approved',async()=>{
 const item=await submit();
 const r=await request('/admin/api/submissions/'+item.id+'/reject',{},true);assert.equal(r.status,200);assert.equal(r.body.item.experienceId,null);
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
 for(const sql of ["UPDATE event_submissions SET status='APPROVED' WHERE id=$1","UPDATE event_submissions SET status='REJECTED',reviewed_at=CURRENT_TIMESTAMP WHERE id=$1"]){await assert.rejects(()=>db.query(sql,[item.id]),error=>error.code==='23514');}
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
 body.event.categoryIds.push(second);delete body.event.schedule.timeZone;body.event.schedule.allDay=true;
 body.event.schedule.startTime='19:00';body.event.schedule.endTime='01:00';body.event.schedule.endsNextDay=true;
 const item=await submit(body);
 const pending=(await db.query('SELECT payload FROM event_submissions WHERE id=$1',[item.id])).rows[0].payload;
 assert.equal(pending.event.schedule.timeZone,'America/New_York');assert.equal(pending.event.schedule.startTime,null);assert.equal(pending.event.schedule.endTime,null);assert.equal(pending.event.schedule.endsNextDay,undefined);
 const approved=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(approved.status,200,JSON.stringify(approved.body));
 const schedule=(await db.query('SELECT * FROM experience_schedules WHERE experience_id=$1',[approved.body.item.experienceId])).rows[0];
 assert.equal(schedule.all_day,true);assert.equal(schedule.time_zone,'America/New_York');assert.equal(schedule.end_time,null);
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

test('admin feed preview is read-only and selected events are queued once with source and unknown price', async () => {
 const route = '/admin/api/event-imports';
 assert.equal((await request(route)).status, 401);
 const preview = await request(route, undefined, true);
 assert.equal(preview.status, 200);
 const [parks, rexburg] = preview.body.feeds;
 assert.equal(parks.records, 0);
 const candidate = rexburg.items.find(item => item.title === 'Community lantern walk');
 assert.equal(candidate.issue, null);
 assert.equal(rexburg.hidden, 2);
 assert.ok(!rexburg.items.some(item => ['Christmas Day','City Hall Closed'].includes(item.title)));
 assert.ok(rexburg.items.some(item => item.title === 'Christmas Concert'));
 const counts = async () => (await db.query('SELECT count(*)::int AS count FROM experiences')).rows[0].count;
 const publishedBefore = await counts();
 const body = {source:'rexburg', id:candidate.id, venue:{businessId:ids.business}, categoryId:ids.category};
 assert.equal((await request(route, body, true, {'X-CSRF-Token':'invalid'})).status, 403);
 const queued = await request(route, body, true);
 assert.equal(queued.status, 201, JSON.stringify(queued.body));
 const repeat = await request(route, body, true);
 assert.equal(repeat.status, 200);
 assert.equal(queued.body.item.id, repeat.body.item.id);
 assert.equal(await counts(), publishedBefore);
 const row = (await db.query('SELECT payload FROM event_submissions WHERE id=$1',[queued.body.item.id])).rows[0];
 assert.equal(row.payload.event.sourceUrl, 'https://www.rexburg.org/events?id=51');
 assert.equal(row.payload.event.priceAmount, null);
 const next = await request(route, undefined, true);
 assert.ok(!next.body.feeds[1].items.some(item => item.id === candidate.id));
});


test('feed sync queues qualified events once and remembers dismissals before and after queueing', async () => {
 const route = '/admin/api/event-imports';
 await db.query("INSERT INTO categories(id,name,slug) VALUES ($1,'Community (Feed Test)','hyena-seed-community') ON CONFLICT (slug) DO NOTHING",[randomUUID()]);
 const initial = await request(route, undefined, true);
 const items = initial.body.feeds[1].items;
 const fair = items.find(item => item.title === 'Winter craft fair');
 const concert = items.find(item => item.title === 'Christmas Concert');
 const dismiss = id => request(route+'/dismiss', {source:'rexburg',id}, true);
 assert.equal((await dismiss(fair.id)).status, 200);
 assert.equal((await request(route+'/sync', {}, false)).status, 401);
 const synced = await request(route+'/sync', {}, true);
 assert.equal(synced.status, 200, JSON.stringify(synced.body));
 assert.equal(synced.body.accepted, 2);
 assert.equal((await request(route+'/sync', {}, true)).body.queued, 0);
 const status = async id => (await db.query('SELECT status,published_experience_id AS published FROM event_submissions WHERE client_request_id=$1',[id])).rows[0];
 assert.equal((await status(concert.id)).status,'APPROVED');
 assert.equal((await status(fair.id)).status, 'REJECTED');
 const concertRow=(await db.query('SELECT id FROM event_submissions WHERE client_request_id=$1',[concert.id])).rows[0];
 assert.equal((await request('/admin/api/submissions/'+concertRow.id+'/undo',{},true)).status,200);
 assert.equal((await request(route+'/sync',{},true)).body.accepted,0);
 assert.equal((await dismiss(concert.id)).status, 200);
 assert.deepEqual(await status(concert.id), {status:'REJECTED',published:null});
 assert.equal((await request(route+'/sync', {}, true)).body.queued, 0);
 const visible = (await request(route, undefined, true)).body.feeds[1].items;
 assert.ok(!visible.some(item => [fair.id,concert.id].includes(item.id)));
});


test('undo approval withdraws the published event and allows reapproval without recreating its venue', async () => {
 const submitted = await submit();
 const endpoint = '/admin/api/submissions/'+submitted.id;
 const approved = await request(endpoint+'/approve', {}, true);
 assert.equal(approved.status,200);
 const oldId = approved.body.item.experienceId;
 assert.equal((await request(endpoint+'/undo', {}, false)).status,401);
 assert.equal((await request(endpoint+'/undo', {}, true, {'X-CSRF-Token':'bad'})).status,403);
 assert.equal((await request(endpoint+'/undo', {}, true)).status,200);
 assert.equal((await request('/api/v1/experiences/'+oldId)).status,404);
 const pending = (await db.query('SELECT * FROM event_submissions WHERE id=$1',[submitted.id])).rows[0];
 assert.equal(pending.status,'PENDING');
 assert.equal(pending.published_experience_id,null);
 assert.equal(pending.reviewed_by,null);
 assert.equal((await request(endpoint+'/undo', {}, true)).status,200);
 assert.equal((await request(endpoint+'/approve', {}, true)).status,200);
 assert.equal((await db.query('SELECT is_active FROM experiences WHERE id=$1',[oldId])).rows[0].is_active,false);
});

test('undo feed rejection removes its blacklist entry and restores reviewable categories', async () => {
 const route = '/admin/api/event-imports';
 const {feeds} = (await request(route,undefined,true)).body;
 // Restore a rejected feed event from the previous sync test.
 const rejected = (await db.query("SELECT id FROM event_submissions WHERE status='REJECTED' AND payload#>>'{event,title}'='Winter craft fair'")).rows[0];
 assert.ok(rejected);
 assert.equal((await request('/admin/api/submissions/'+rejected.id+'/undo',{},true)).status,200);
 const restored = (await db.query('SELECT payload,status FROM event_submissions WHERE id=$1',[rejected.id])).rows[0];
 assert.equal(restored.status,'PENDING');
 assert.deepEqual(restored.payload.event.categoryIds,[]);
 const preview = (await request(route,undefined,true)).body;
 assert.ok(!preview.feeds[1].items.some(item=>item.title==='Winter craft fair'));
});

test('manual submissions can omit description, type and categories and remain Pending with Other',async()=>{
 const body=event();
 delete body.event.description;
 delete body.event.type;
 delete body.event.categoryIds;
 const receipt=await submit(body);
 assert.equal(receipt.status,'PENDING');
 const row=(await db.query('SELECT payload FROM event_submissions WHERE id=$1',[receipt.id])).rows[0];
 assert.equal(row.payload.event.type,'OTHER');
 assert.equal(row.payload.event.description,null);
 assert.deepEqual(row.payload.event.categoryIds,[]);
});

test('admin can search a venue and accept an address-only location',async()=>{
 assert.equal((await request('/admin/api/venue-search?q=Studio')).status,401);
 const lookup=await request('/admin/api/venue-search?q=Studio',undefined,true);
 assert.equal(lookup.status,200);
 assert.ok(lookup.body.items.length);
 const receipt=await submit();
 const accepted=await request('/admin/api/submissions/'+receipt.id+'/approve',{
  venue:{proposal:{name:'Address Venue',address:'1 Test St',city:'Rexburg'}}
 },true);
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
});

test('minimal feed events automatically publish once with address-derived or coordinate-only venues',async()=>{
 const {createEventImports}=require('../services/eventImports');
 const start=new Date(Date.now()+3*86400000).toISOString();
 const importer=createEventImports({pool,clock:now,fetcher:async url=>{
  if(!url.includes('thrillshare'))throw Error('Other source unavailable in this isolated test');
  return Response.json({events:[
   {id:910001,title:'Minimal address feed event',venue:'88 Main Street',start_at:start},
   {id:910002,title:'Minimal coordinate feed event',venue:'Coordinate pavilion',latitude:43.8,longitude:-111.8,start_at:start},
   {id:910003,title:'Missing start stays pending',venue:'88 Main Street'},
   {id:910004,title:'Missing venue stays pending',start_at:start}
  ]});
 },venueLookup:{
  async resolve(input){return {...input,latitude:43.81,longitude:-111.81};},
  async venue(input){return input;}
 }});
 const summary=await importer.sync();assert.equal(summary.accepted,2,JSON.stringify(summary));
 const published=(await db.query("SELECT e.*,b.address,b.city,b.latitude,s.end_time,s.time_zone FROM experiences e JOIN businesses b ON b.id=e.business_id JOIN experience_schedules s ON s.experience_id=e.id WHERE e.title LIKE 'Minimal % feed event' ORDER BY e.title")).rows;
 assert.equal(published.length,2);
 assert.ok(published.every(e=>e.type==='OTHER' && e.description===null && e.price_amount===null && e.end_time===null));
 assert.ok(published.every(e=>e.latitude!==null && e.time_zone));
 const replay=await importer.sync();assert.equal(replay.accepted,0);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM businesses WHERE name IN ('88 Main Street','Coordinate pavilion')")).rows[0].n,2);
 const pending=(await db.query("SELECT payload,status FROM event_submissions WHERE payload#>>'{event,title}'='Missing start stays pending'")).rows[0];
 assert.equal(pending.status,'PENDING');
});

test('city/state venue and start-only manual event can be approved without optional fields',async()=>{
 const body={clientRequestId:randomUUID(),venue:{proposal:{name:'City gathering',city:'Rexburg',state:'ID'}},
  event:{title:'Minimal manual event',schedule:{startDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),startTime:'19:00'}}};
 const item=await submit(body);assert.equal(item.status,'PENDING');
 const approved=await request('/admin/api/submissions/'+item.id+'/approve',{},true);
 assert.equal(approved.status,200,JSON.stringify(approved.body));
 const detail=await request('/api/v1/experiences/'+approved.body.item.experienceId);
 assert.equal(detail.body.item.description,null);assert.equal(detail.body.item.endTime,null);
 assert.equal(detail.body.item.latitude,null);assert.equal(detail.body.item.state,'ID');
 assert.equal(detail.body.item.type,'OTHER');
});

test('explicit next-day and multi-day dates survive publication and date filtering',async()=>{
 const {parseSubmission}=require('../validation/submission');
 const {findOccurrence}=require('../services/recurrence');
 const input=event();input.event.schedule={startDate:'2030-05-01',endDate:'2030-05-03',startTime:'23:00',endTime:'01:00'};
 const parsed=parseSubmission(input);assert.equal(parsed.success,true);
 const schedule={...parsed.data.payload.event.schedule,scheduleKind:'ONCE',timeZone:'America/Denver'};
 const occurrence=findOccurrence(schedule,{window:'date',date:'2030-05-02',timeZone:'America/Denver'},'2030-05-02T18:00:00Z');
 assert.ok(occurrence);assert.equal(occurrence.startsAt,'2030-05-02T05:00:00Z');assert.equal(occurrence.endsAt,'2030-05-03T07:00:00Z');
});

test('venue reuse compares coordinates at database precision',async()=>{
 const proposal={name:'Precision venue',latitude:43.8000004,longitude:-111.8000004};
 for(let i=0;i<2;i++){
  const item=await submit(event({proposal}));
  const response=await request('/admin/api/submissions/'+item.id+'/approve',{},true);
  assert.equal(response.status,200,JSON.stringify(response.body));
 }
 assert.equal((await db.query("SELECT count(*)::int AS n FROM businesses WHERE name='Precision venue'")).rows[0].n,1);
});

test('admin edits Pending and Approved category, price, venue and time; published ID and original retry stay stable',async()=>{
 const original=event();const item=await submit(original);
 const pending=(await request('/admin/api/submissions?q='+encodeURIComponent(original.event.title),undefined,true)).body.items.find(x=>x.id===item.id);
 const change={revision:pending.revision,event:{categoryIds:[],priceAmount:'0',schedule:{...original.event.schedule,startTime:'19:00',endTime:'21:00'}}};
 assert.equal((await request('/admin/api/submissions/'+item.id+'/edit',change,true)).status,200);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/edit',change,true)).status,409);
 const approved=await request('/admin/api/submissions/'+item.id+'/approve',{},true);assert.equal(approved.status,200,JSON.stringify(approved.body));
 const id=approved.body.item.experienceId;
 const row=(await db.query('SELECT revision FROM event_submissions WHERE id=$1',[item.id])).rows[0];
 const edited=await request('/admin/api/submissions/'+item.id+'/edit',{
  revision:row.revision,venue:{proposal:{name:'Edited venue',city:'Rexburg',state:'ID',latitude:43.82,longitude:-111.79}},
  event:{categoryIds:[ids.category],priceAmount:'12.50',schedule:{...original.event.schedule,startTime:'20:00',endTime:'22:00'}}
 },true);
 assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(edited.body.item.experienceId,id);
 const publicEvent=(await request('/api/v1/experiences/'+id)).body.item;
 assert.equal(publicEvent.priceAmount,'12.50');assert.equal(publicEvent.businessName,'Edited venue');
 assert.deepEqual(publicEvent.categories.map(c=>c.id),[ids.category]);assert.equal(publicEvent.startTime,'20:00:00');
 const retry=await request('/api/v1/submissions',original);assert.equal(retry.status,200);assert.equal(retry.body.item.id,item.id);
 const revision=(await db.query('SELECT revision FROM event_submissions WHERE id=$1',[item.id])).rows[0].revision;
 const invalid=await request('/admin/api/submissions/'+item.id+'/edit',{revision,event:{priceAmount:'-1'}},true);assert.equal(invalid.status,400);
 assert.equal((await request('/api/v1/experiences/'+id)).body.item.priceAmount,'12.50');
});

test('admin priority lists community before feeds, filters source, and searches titles',async()=>{
 const community=await submit(event());const feedBody=event();feedBody.event.title='Priority feed entry';
 const {parseSubmission}=require('../validation/submission');const {submitEvent}=require('../services/submissions');
 const feed=await submitEvent(pool,parseSubmission(feedBody).data,now(),{sourceKind:'FEED'});
 const first=(await request('/admin/api/submissions',undefined,true)).body;
 assert.equal(first.items[0].sourceKind,'USER');
 const feeds=(await request('/admin/api/submissions?origin=FEED&q=Priority',undefined,true)).body.items;
 assert.equal(feeds.length,1);assert.equal(feeds[0].id,feed.item.id);
 assert.ok(!(await request('/admin/api/submissions?origin=FEED',undefined,true)).body.items.some(x=>x.id===community.id));
});

test('duplicate approvals are blocked across sources but different start times and venues survive',async()=>{
 const firstBody=event();firstBody.event.title='One Community Concert! '+randomUUID().slice(0,8);
 const first=await submit(firstBody);const accepted=await reviewSubmission(pool,first.id,'APPROVED','reviewer');
 const duplicateBody=structuredClone(firstBody);duplicateBody.clientRequestId=randomUUID();duplicateBody.event.title=firstBody.event.title.toUpperCase().replace('!','');
 const duplicate=await submit(duplicateBody);
 await assert.rejects(()=>reviewSubmission(pool,duplicate.id,'APPROVED','reviewer'),e=>e.code==='DUPLICATE_EVENT');
 const auto=await reviewSubmission(pool,duplicate.id,'APPROVED','importer',{automatic:true});
 assert.equal(auto.status,'REJECTED');assert.equal(auto.duplicateOf,accepted.experienceId);
 const later=structuredClone(firstBody);later.clientRequestId=randomUUID();later.event.schedule.startTime='21:00';later.event.schedule.endTime='22:00';
 assert.equal((await request('/admin/api/submissions/'+(await submit(later)).id+'/approve',{},true)).status,200);
 const elsewhere=structuredClone(firstBody);elsewhere.clientRequestId=randomUUID();elsewhere.venue={proposal:{name:'Separate venue',address:'999 Other Street',city:'Rexburg',latitude:43.82,longitude:-111.79}};
 assert.equal((await request('/admin/api/submissions/'+(await submit(elsewhere)).id+'/approve',{},true)).status,200);
});

test('expired approved events disappear publicly and from the default admin list but remain in archive',async()=>{
 const body=event();body.event.title='Lifecycle archive '+randomUUID().slice(0,8);
 const item=await submit(body);const published=await reviewSubmission(pool,item.id,'APPROVED','reviewer');
 const revision=(await db.query('SELECT revision FROM event_submissions WHERE id=$1',[item.id])).rows[0].revision;
 const moved=await request('/admin/api/submissions/'+item.id+'/edit',{revision,event:{schedule:{...body.event.schedule,startDate:'2020-10-31',endDate:'2020-10-31'}}},true);
 assert.equal(moved.status,200,JSON.stringify(moved.body));
 assert.equal((await request('/api/v1/experiences/'+published.experienceId)).status,404);
 assert.equal((await request('/admin/api/submissions?status=APPROVED&q=Lifecycle',undefined,true)).body.items.length,0);
 const archive=(await request('/admin/api/submissions?status=APPROVED&includePast=true&q=Lifecycle',undefined,true)).body.items;
 assert.equal(archive.length,1);assert.equal(archive[0].past,true);
});

test('community-first pagination crosses the feed boundary without skipping entries',async()=>{
 const payload= require('../validation/submission').parseSubmission(event()).data.payload;
 for(let i=0;i<54;i++){
  const value=structuredClone(payload);value.event.title='Pagination group '+i;
  await db.query("INSERT INTO event_submissions(id,client_request_id,payload,source_kind,created_at) VALUES($1,$2,$3::jsonb,$4,'2026-01-01T10:00:00.000001Z')",[randomUUID(),randomUUID(),JSON.stringify(value),i<51?'USER':'FEED']);
 }
 const page1=(await request('/admin/api/submissions?q=Pagination%20group',undefined,true)).body;
 assert.equal(page1.items.length,50);assert.ok(page1.items.every(x=>x.sourceKind==='USER'));
 const page2=(await request('/admin/api/submissions?q=Pagination%20group&before='+page1.nextCursor,undefined,true)).body;
 assert.deepEqual(page2.items.map(x=>x.sourceKind),['USER','FEED','FEED','FEED']);
 assert.equal(new Set([...page1.items,...page2.items].map(x=>x.id)).size,54);
});

test('admin editing requires authentication, CSRF and a current revision',async()=>{
 const item=await submit();const path='/admin/api/submissions/'+item.id+'/edit';
 assert.equal((await request(path,{revision:0,event:{priceAmount:'0'}})).status,401);
 assert.equal((await request(path,{revision:0,event:{priceAmount:'0'}},false,{Cookie:session.cookie})).status,403);
 assert.equal((await request(path,{event:{priceAmount:'0'}},true)).status,400);
 const saved=await request(path,{revision:0,event:{priceAmount:'0'}},true);assert.equal(saved.status,200);
 assert.equal((await request('/admin/api/submissions/'+item.id+'/approve',{revision:0},true)).status,409);
});

test('clearing optional categories keeps the listing discoverable under Other',async()=>{
 const body=event();body.event.categoryIds=[];
 const item=await submit(body);const approved=await reviewSubmission(pool,item.id,'APPROVED','reviewer');
 const other=(await db.query("SELECT id FROM categories WHERE slug='other'")).rows[0].id;
 const found=await request('/api/v1/experiences?latitude=43.8231&longitude=-111.7924&radiusMiles=100&window=all&categoryIds='+other+'&q='+encodeURIComponent(body.event.title));
 assert.equal(found.status,200,JSON.stringify(found.body));assert.ok(found.body.items.some(e=>e.id===approved.experienceId));
});

test('a duplicate found through a venue alias does not leave an unused new venue',async()=>{
 const original=event();original.event.title='Venue alias duplicate '+randomUUID().slice(0,8);
 const accepted=await reviewSubmission(pool,(await submit(original)).id,'APPROVED','reviewer');
 const count=(await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n;
 const alias=structuredClone(original);alias.clientRequestId=randomUUID();alias.venue={proposal:{name:'Alias of Open Studio',address:'1 Test St',city:'Rexburg',latitude:43.8231,longitude:-111.7924}};
 const result=await reviewSubmission(pool,(await submit(alias)).id,'APPROVED','feed importer',{automatic:true});
 assert.equal(result.duplicateOf,accepted.experienceId);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n,count);
});

test('bulk category and price editing is atomic, revision checked and preserves unrelated fields',async()=>{
 const one=await submit(),two=await submit();
 const first=await request('/admin/api/submissions/bulk-edit',{entries:[{id:one.id,revision:0},{id:two.id,revision:0}],event:{priceAmount:'0',categoryIds:[]}},true);
 assert.equal(first.status,200,JSON.stringify(first.body));
 for(const id of [one.id,two.id]){const row=(await db.query('SELECT payload,revision FROM event_submissions WHERE id=$1',[id])).rows[0];assert.equal(row.payload.event.priceAmount,'0');assert.deepEqual(row.payload.event.categoryIds,[]);assert.equal(row.revision,1);}
 const stale=await request('/admin/api/submissions/bulk-edit',{entries:[{id:one.id,revision:1},{id:two.id,revision:0}],event:{priceAmount:'10'}},true);
 assert.equal(stale.status,409);
 for(const id of [one.id,two.id])assert.equal((await db.query('SELECT payload FROM event_submissions WHERE id=$1',[id])).rows[0].payload.event.priceAmount,'0');
 assert.equal((await request('/admin/api/submissions/bulk-edit',{entries:[{id:one.id,revision:1}],event:{priceAmount:'-1'}},true)).status,400);
 assert.equal((await request('/admin/api/submissions/bulk-edit',{entries:[{id:one.id,revision:1}],event:{priceAmount:null}},false)).status,401);
});

test('saved refresh follows edits and returns confirmed unavailable IDs without depending on radius filters',async()=>{
 const body=event();const receipt=await submit(body);const approved=await reviewSubmission(pool,receipt.id,'APPROVED','reviewer');
 const id=approved.experienceId,missing=randomUUID();
 const updated=await request('/admin/api/submissions/'+receipt.id+'/edit',{revision:1,event:{priceAmount:'0',schedule:{...body.event.schedule,startTime:'21:00',endTime:'22:00'}}},true);assert.equal(updated.status,200);
 const response=await request('/api/v1/experiences/saved-refresh?ids='+id+','+missing);
 assert.equal(response.status,200,JSON.stringify(response.body));assert.deepEqual(response.body.unavailableIds,[missing]);
 assert.equal(response.body.items[0].priceAmount,'0.00');assert.ok(response.body.items[0].nextOccurrence);assert.equal(response.body.items[0].startTime,'21:00:00');
 await reviewSubmission(pool,receipt.id,'PENDING','reviewer');
 assert.deepEqual((await request('/api/v1/experiences/saved-refresh?ids='+id)).body.unavailableIds,[id]);
 assert.equal((await request('/api/v1/experiences/saved-refresh?ids=bad')).status,400);
});

test('feed reschedules and cancellations create one alert, apply preserves price/categories and cancellation withdraws',async()=>{
 const {createEventImports}=require('../services/eventImports');
 const sourceId=930001,title='Source change tracking '+randomUUID().slice(0,8);
 const start=new Date(Date.now()+3*86400000),end=new Date(start.getTime()+3600000);
 const source={id:sourceId,title,venue:'Open Studio',start_at:start.toISOString(),end_at:end.toISOString()};
 const importer=value=>createEventImports({pool,clock:now,fetcher:async url=>{if(url.includes('thrillshare'))return Response.json({events:[value]});throw Error('Only one source in this test');}});
 assert.equal((await importer(source).sync()).accepted,1);
 const row=(await db.query("SELECT * FROM event_submissions WHERE payload#>>'{event,title}'=$1",[title])).rows[0];
 await reviewSubmission(pool,row.id,'EDIT','reviewer',{revision:row.revision,event:{priceAmount:'7',categoryIds:[ids.category]}});
 const moved={...source,start_at:new Date(start.getTime()+7200000).toISOString(),end_at:new Date(end.getTime()+7200000).toISOString()};
 await importer(moved).sync();await importer(moved).sync();
 let changes=(await request('/admin/api/feed-changes',undefined,true)).body.items.filter(x=>x.submissionId===row.id);
 assert.equal(changes.length,1);assert.equal(changes[0].kind,'RESCHEDULE');
 const applied=await request('/admin/api/feed-changes/'+changes[0].id+'/apply',{submissionRevision:changes[0].submissionRevision},true);assert.equal(applied.status,200,JSON.stringify(applied.body));
 const changed=(await db.query('SELECT payload FROM event_submissions WHERE id=$1',[row.id])).rows[0].payload.event;
 assert.equal(changed.priceAmount,'7');assert.deepEqual(changed.categoryIds,[ids.category]);
 await importer(moved).sync();assert.equal((await request('/admin/api/feed-changes',undefined,true)).body.items.filter(x=>x.submissionId===row.id).length,0);
 const canceled={...moved,title:'Canceled: '+title};await importer(canceled).sync();
 changes=(await request('/admin/api/feed-changes',undefined,true)).body.items.filter(x=>x.submissionId===row.id);
 assert.equal(changes[0].kind,'CANCELLATION');
 assert.equal((await request('/admin/api/feed-changes/'+changes[0].id+'/apply',{submissionRevision:changes[0].submissionRevision},true)).status,200);
 assert.equal((await request('/api/v1/experiences/'+row.published_experience_id)).status,404);
 assert.equal((await db.query('SELECT status FROM event_submissions WHERE id=$1',[row.id])).rows[0].status,'REJECTED');
});

test('applying a schedule-only feed update keeps a curator title', async () => {
 const {snapshot,observe}=require('../services/feedChanges');
 const body=event();
 const receipt=await submit(body);
 await reviewSubmission(pool,receipt.id,'APPROVED','reviewer');
 const source={title:body.event.title,schedule:body.event.schedule,venue:'Open Studio',city:'Rexburg'};
 const baseline=snapshot(source);
 const curatedTitle='Curated '+randomUUID();
 const row=(await db.query('SELECT revision FROM event_submissions WHERE id=$1',[receipt.id])).rows[0];
 await reviewSubmission(pool,receipt.id,'EDIT','reviewer',{revision:row.revision,event:{title:curatedTitle}});

 const schedule={...source.schedule,startTime:'15:00',endTime:'16:00'};
 await observe(pool,{...source,schedule,submissionId:receipt.id,sourceSnapshot:baseline});
 const alert=(await request('/admin/api/feed-changes',undefined,true)).body.items.find(x=>x.submissionId===receipt.id);
 const applied=await request('/admin/api/feed-changes/'+alert.id+'/apply',{submissionRevision:alert.submissionRevision},true);
 assert.equal(applied.status,200,JSON.stringify(applied.body));
 const saved=(await db.query('SELECT payload FROM event_submissions WHERE id=$1',[receipt.id])).rows[0].payload.event;
 assert.equal(saved.title,curatedTitle);
 assert.match(saved.schedule.startTime,/^15:00/);
});

test('dismissing a source alert keeps admin edits and stale source actions are rejected',async()=>{
 const {snapshot,observe}=require('../services/feedChanges');
 const body=event();const receipt=await submit(body);await reviewSubmission(pool,receipt.id,'APPROVED','reviewer');
 const old={title:body.event.title,schedule:body.event.schedule,venue:'Open Studio',city:'Rexburg'};
 const baseline=snapshot(old);await db.query('UPDATE event_submissions SET source_snapshot=$2::jsonb WHERE id=$1',[receipt.id,JSON.stringify(baseline)]);
 const changed={...old,title:'Source new title '+randomUUID().slice(0,8),submissionId:receipt.id,sourceSnapshot:baseline};
 await observe(pool,changed);
 const alert=(await request('/admin/api/feed-changes',undefined,true)).body.items.find(x=>x.submissionId===receipt.id);
 const edited=await request('/admin/api/submissions/'+receipt.id+'/edit',{revision:alert.submissionRevision,event:{priceAmount:'15'}},true);assert.equal(edited.status,200);
 assert.equal((await request('/admin/api/feed-changes/'+alert.id+'/apply',{submissionRevision:alert.submissionRevision},true)).status,409);
 const current=(await request('/admin/api/feed-changes',undefined,true)).body.items.find(x=>x.id===alert.id);
 assert.equal((await request('/admin/api/feed-changes/'+alert.id+'/dismiss',{submissionRevision:current.submissionRevision},true)).status,200);
 const saved=(await db.query('SELECT payload,source_snapshot FROM event_submissions WHERE id=$1',[receipt.id])).rows[0];
 assert.equal(saved.payload.event.title,body.event.title);assert.equal(saved.payload.event.priceAmount,'15');
 await observe(pool,{...changed,sourceSnapshot:saved.source_snapshot});
 assert.equal((await request('/admin/api/feed-changes',undefined,true)).body.items.filter(x=>x.id===alert.id).length,0);
});

test('a source change that reappears after reverting reopens its alert',async()=>{
 const {snapshot,observe}=require('../services/feedChanges');const body=event();const item=await submit(body);
 const source={title:body.event.title,schedule:body.event.schedule,venue:'Open Studio',city:'Rexburg'};
 const baseline=snapshot(source),changed={...source,title:'Reappearing source title',submissionId:item.id,sourceSnapshot:baseline};
 await observe(pool,changed);await observe(pool,{...source,submissionId:item.id,sourceSnapshot:baseline});
 assert.equal((await db.query("SELECT status FROM feed_changes WHERE submission_id=$1",[item.id])).rows[0].status,'RESOLVED');
 await observe(pool,changed);
 const rows=(await db.query('SELECT status FROM feed_changes WHERE submission_id=$1',[item.id])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].status,'OPEN');
});

test('approve applies a time edit and moves the listing atomically; invalid time leaves Pending untouched',async()=>{
 const original=event();
 const item=await submit(original);
 const review='/admin/api/submissions/'+item.id+'/approve';
 const [before]=(await db.query('SELECT status,payload,revision,published_experience_id FROM event_submissions WHERE id=$1',[item.id])).rows;
 const invalid=await request(review,{revision:before.revision,event:{title:'Should not be saved',
  schedule:{startTime:'21:30',endTime:'20:30'}}},true);
 assert.equal(invalid.status,400);
 assert.equal(invalid.body.error.code,'EVENT_DETAILS_REQUIRED');
 assert.ok(invalid.body.error.fields.some(x=>x.field==='event.schedule.endTime'));
 const [afterFailure]=(await db.query('SELECT status,payload,revision,published_experience_id FROM event_submissions WHERE id=$1',[item.id])).rows;
 assert.deepEqual(afterFailure,before);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM experiences WHERE title IN ($1,'Should not be saved')",[original.event.title])).rows[0].n,0);
 const approved=await request(review,{revision:before.revision,event:{schedule:{startTime:'19:30',endTime:'21:30'}}},true);
 assert.equal(approved.status,200,JSON.stringify(approved.body));
 assert.equal(approved.body.item.status,'APPROVED');
 const published=await request('/api/v1/experiences/'+approved.body.item.experienceId);
 assert.equal(published.status,200);
 assert.equal(published.body.item.startTime,'19:30:00');
 assert.equal(published.body.item.endTime,'21:30:00');
 const search='&q='+encodeURIComponent(original.event.title);
 const pending=await request('/admin/api/submissions?status=PENDING'+search,undefined,true);
 const approvedQueue=await request('/admin/api/submissions?status=APPROVED'+search,undefined,true);
 assert.ok(!pending.body.items.some(x=>x.id===item.id));
 assert.equal(approvedQueue.body.items.find(x=>x.id===item.id).payload.event.schedule.startTime,'19:30:00');
});

test('an approved time-only edit keeps the listing ID and the stored venue time zone',async()=>{
 const original=event();
 original.event.schedule.timeZone='America/Los_Angeles';
 const item=await submit(original);
 const approved=await request('/admin/api/submissions/'+item.id+'/approve',{revision:0},true);
 assert.equal(approved.status,200);
 const id=approved.body.item.experienceId;
 const edited=await request('/admin/api/submissions/'+item.id+'/edit',{revision:1,
  event:{schedule:{startTime:'19:45',endTime:'22:00'}}},true);
 assert.equal(edited.status,200,JSON.stringify(edited.body));
 assert.equal(edited.body.item.experienceId,id);
 const listing=await request('/api/v1/experiences/'+id);
 assert.equal(listing.body.item.startTime,'19:45:00');
 const [saved]=(await db.query('SELECT time_zone FROM experience_schedules WHERE experience_id=$1',[id])).rows;
 assert.equal(saved.time_zone,'America/Los_Angeles');
});

test('an ongoing weekly listing can be approved after its first occurrence',async()=>{
 const recurring=event();
 const date=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
 recurring.event.schedule={kind:'WEEKLY',startDate:date(-21),endDate:date(21),startTime:'18:00',endTime:'20:00',
  weekdays:[3],timeZone:'America/Denver'};
 const item=await submit(recurring);
 const result=await request('/admin/api/submissions/'+item.id+'/approve',{revision:0,event:{schedule:{startTime:'19:00'}}},true);
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal((await request('/api/v1/experiences/'+result.body.item.experienceId)).body.item.startTime,'19:00:00');
});
