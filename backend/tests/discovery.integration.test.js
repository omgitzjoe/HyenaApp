const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const createExperienceRouter = require('../routes/experiences');
const createCategoryRouter = require('../routes/categories');
const { discoverExperiences } = require('../services/discovery');
const { DiscoveryQueryError } = require('../validation/discovery');
const clock = '2026-10-28T18:00:00Z';
let db, server, url;
const ids={};
const logger={warn(){},error(){}};
async function addExperience(title,options={}) {
    const id=randomUUID(), scheduleId=randomUUID();
    await db.query(`INSERT INTO experiences (id,business_id,title,description,type,price_label,is_active)
        VALUES ($1,$2,$3,$4,'EVENT',$5,$6)`,[id,options.businessId||ids.business,title,options.description||'Fixture',options.offer??null,options.active??true]);
    await db.query(`INSERT INTO experience_schedules (id,experience_id,kind,start_date,end_date,start_time,end_time,ends_next_day,time_zone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[scheduleId,id,options.kind||'ONCE',options.startDate||'2026-10-28',options.endDate===undefined?(options.startDate||'2026-10-28'):options.endDate,options.startTime||'17:00',options.endTime||'21:00',options.overnight||false,options.zone||'America/Denver']);
    for(const categoryId of options.categories||[ids.food])await db.query('INSERT INTO experience_categories VALUES ($1,$2)',[id,categoryId]);
    for(const day of options.weekdays||[])await db.query('INSERT INTO experience_schedule_days VALUES ($1,$2)',[scheduleId,day]);
    return id;
}
before(async()=>{
    db=new PGlite(); await db.waitReady;
    await db.exec(fs.readFileSync(path.join(__dirname,'../db/migrations/initial_schema.sql'),'utf8'));
    for(const k of ['area','inactiveArea','business','closedBusiness','inactiveAreaBusiness','food','music','unused'])ids[k]=randomUUID();
    await db.query("INSERT INTO discovery_areas (id,name,slug,time_zone,is_active) VALUES ($1,'Active Area','active','America/Denver',TRUE),($2,'Inactive Area','inactive','America/Denver',FALSE)",[ids.area,ids.inactiveArea]);
    await db.query("INSERT INTO businesses (id,area_id,name,address,city,is_active) VALUES ($1,$2,'Joe''s Café','1 Test St','Test City',TRUE),($3,$2,'Closed Venue','2 Test St','Test City',FALSE),($4,$5,'Hidden Area Venue','3 Test St','Test City',TRUE)",[ids.business,ids.area,ids.closedBusiness,ids.inactiveAreaBusiness,ids.inactiveArea]);
    await db.query("INSERT INTO categories (id,name,slug) VALUES ($1,'Food','food'),($2,'Music','music'),($3,'Unused','unused')",[ids.food,ids.music,ids.unused]);
    // More than a page of earlier-sorting expired records detects LIMIT-before-filter regressions.
    for(let n=0;n<25;n++)await addExperience(`A expired ${n}`,{startDate:'2020-01-01'});
    ids.valid=await addExperience('Zulu Dinner',{description:'Family evening',offer:'Free entry',categories:[ids.food,ids.music]});
    ids.weekly=await addExperience('Weekly Café',{kind:'WEEKLY',startDate:'2026-01-01',endDate:null,weekdays:[3,5],categories:[ids.music]});
    ids.percent=await addExperience('Save 50% _ Today');
    await db.query('UPDATE experiences SET price_amount=$2, currency=$3 WHERE id=$1', [ids.valid, '0', 'USD']);
    await db.query('UPDATE experiences SET price_amount=$2, currency=$3 WHERE id=$1', [ids.weekly, '10.50', 'USD']);
    await db.query('UPDATE experiences SET price_amount=$2, currency=$3 WHERE id=$1', [ids.percent, '10.51', 'USD']);
    await addExperience('Inactive Experience',{active:false});
    await addExperience('Closed Venue Event',{businessId:ids.closedBusiness});
    await addExperience('Inactive Area Event',{businessId:ids.inactiveAreaBusiness});
    ids.overnight=await addExperience('Yesterday Overnight',{startDate:'2026-10-27',startTime:'23:00',endTime:'01:00',overnight:true});
    const app=express();
    app.use('/api/v1/categories',createCategoryRouter({pool:db,logger}));
    app.use('/api/v1/experiences',createExperienceRouter({pool:db,clock:()=>clock,logger}));
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    url=`http://127.0.0.1:${server.address().port}/api/v1/experiences`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
async function get(query=''){const r=await fetch(url+query);return {status:r.status,body:await r.json()};}
test('HTTP default today evaluates all SQL candidates before limit',async()=>{
    const {status,body}=await get();assert.equal(status,200);assert.equal(body.count,3);
    assert.ok(body.items.some(x=>x.id===ids.valid));assert.equal(body.window,'today');
    assert.ok(body.items.every(x=>x.nextOccurrence));assert.equal(body.evaluatedAt,clock);
});
test('database keyword search covers description, offer, business, and category',async()=>{
    assert.equal((await get('?q=family')).body.count,1);
    assert.equal((await get('?q=free')).body.count,1);
    assert.equal((await get('?q=Caf%C3%A9')).body.count,3);
    assert.equal((await get('?q=Music')).body.count,2);
});
test('literal wildcard characters do not become SQL wildcards',async()=>{
    assert.equal((await get('?q=%25')).body.count,1);
    assert.equal((await get('?q=_')).body.count,1);
    assert.equal((await get('?q=%5C')).body.count,0);
});
test('SQL-looking input is treated as a literal search string',async()=>{
    assert.equal((await get("?q="+encodeURIComponent("'; DROP TABLE experiences; --"))).body.count,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM experiences')).rows[0].n,32);
});
test('SQL area/category filters combine with keyword/date filters',async()=>{
    const r=await get(`?areaId=${ids.area}&categoryId=${ids.music}&q=Zulu`);
    assert.equal(r.status,200);assert.deepEqual(r.body.items.map(x=>x.id),[ids.valid]);
    assert.equal((await get(`?categoryId=${ids.unused}`)).body.count,0);
});
test('unknown and inactive areas are rejected',async()=>{
    for(const id of [randomUUID(),ids.inactiveArea]){const r=await get(`?areaId=${id}`);assert.equal(r.status,400);assert.equal(r.body.error.code,'INVALID_AREA');}
});
test('unknown categories are rejected',async()=>assert.equal((await get(`?categoryId=${randomUUID()}`)).status,400));
test('window all exposes expired listings but never inactive parents',async()=>{
    const r=await get('?window=all&limit=100');assert.equal(r.body.count,29);
    assert.ok(r.body.items.some(x=>x.title.startsWith('A expired')));
    assert.ok(r.body.items.every(x=>!['Inactive Experience','Closed Venue Event','Inactive Area Event'].includes(x.title)));
});
test('limits are applied to matched experiences, not joined category rows',async()=>{
    const r=await get('?limit=1');assert.equal(r.body.count,1);assert.equal(r.body.hasMore,true);
    assert.equal((await get('?q=Zulu')).body.count,1);
});
test('selected historical date returns expired occurrences',async()=>{
    const r=await get('?window=date&date=2020-01-01&limit=100');assert.equal(r.body.count,25);assert.ok(r.body.items.every(x=>x.nextOccurrence.status==='EXPIRED'));
});
test('now and tonight HTTP windows differ',async()=>{
    assert.equal((await get('?window=now')).body.count,0);
    assert.equal((await get('?window=tonight')).body.count,3);
});
test('overnight database schedule is visible during the following local day',async()=>{
    const r=await discoverExperiences(db,{window:'now'},'2026-10-28T06:30:00Z',logger);
    assert.ok(r.items.some(x=>x.id===ids.overnight));
});
test('detail endpoint still works and returns date-only strings and ordered weekdays',async()=>{
    const r=await get('/'+ids.weekly);assert.equal(r.status,200);assert.equal(r.body.item.startDate,'2026-01-01');assert.deepEqual(r.body.item.weekdays,[3,5]);
    assert.equal((await get('/'+ids.valid)).body.item.categories.length,2);
});
test('existing invalid/missing detail responses are preserved',async()=>{
    assert.equal((await get('/not-a-uuid')).status,400);assert.equal((await get('/'+randomUUID())).status,404);
});
for(const query of ['?window=bad','?window=date&date=2026-02-30','?window=date','?limit=0','?q=a&q=b','?areaId=bad','?categoryId=bad','?date=2026-10-28','?cursor=next'])
    test('HTTP rejects '+query,async()=>assert.equal((await get(query)).status,400));
test('database outage becomes a safe 500 response',async()=>{
    const app=express();app.use('/api/v1/experiences',createExperienceRouter({pool:{query:async()=>{throw Error('private connection detail');}},clock:()=>clock,logger}));
    const s=await new Promise(resolve=>{const candidate=app.listen(0,'127.0.0.1',()=>resolve(candidate));});
    try{const r=await fetch(`http://127.0.0.1:${s.address().port}/api/v1/experiences`);assert.equal(r.status,500);assert.ok(!(await r.text()).includes('private connection'));}
    finally{await new Promise(r=>s.close(r));}
});

test('proximity excludes missing coordinates and filters before limit', async () => {
    assert.equal((await get('?window=all&latitude=39.7392&longitude=-104.9903')).body.count, 0);
    try {
        await db.query('UPDATE businesses SET latitude=39.7392, longitude=-104.9903 WHERE id=$1', [ids.business]);
        const near = await get('?latitude=39.7392&longitude=-104.9903&radiusMiles=5&limit=1&timeZone=America%2FDenver');
        assert.equal(near.status, 200); assert.equal(near.body.count, 1); assert.equal(near.body.hasMore, true);
        assert.equal(near.body.items[0].distanceMiles, 0);
        assert.equal('latitude' in near.body.items[0], false);
        assert.equal((await get('?latitude=40.7128&longitude=-74.0060&radiusMiles=25')).body.count, 0);
        assert.equal((await get('?latitude=39.7392&longitude=-104.9903&q=family')).body.count, 1);
    } finally { await db.query('UPDATE businesses SET latitude=NULL, longitude=NULL WHERE id=$1', [ids.business]); }
});
test('distance handles antimeridian', async () => {
    try {
        await db.query('UPDATE businesses SET latitude=0, longitude=-179.99 WHERE id=$1', [ids.business]);
        const r = await get('?latitude=0&longitude=179.99&radiusMiles=5');
        assert.equal(r.body.count, 3); assert.ok(r.body.items.every(x => x.distanceMiles < 2));
    } finally { await db.query('UPDATE businesses SET latitude=NULL, longitude=NULL WHERE id=$1', [ids.business]); }
});
test('HTTP rejects malformed proximity and time zone', async () => {
    for (const query of ['?latitude=91&longitude=0', '?timeZone=Mars%2FUnknown', '?latitude=0', '?radiusMiles=5']) assert.equal((await get(query)).status, 400);
});
test('HTTP viewer tonight differs from venue tonight', async () => {
    assert.equal((await get('?window=tonight&timeZone=UTC')).body.count, 3);
    assert.equal((await get('?window=tonight&timeZone=Asia%2FTokyo')).body.count, 0);
});

test('Free uses numeric zero and excludes unknown prices', async () => {
    const r = await get('?window=all&price=free');
    assert.equal(r.status,200); assert.deepEqual(r.body.items.map(x=>x.id),[ids.valid]);
    // Old fixtures without numeric prices are retained by Any price.
    assert.equal((await get('?window=all&price=any&limit=100')).body.count,29);
});
test('maximum price includes exact boundary and excludes higher amounts', async () => {
    const r = await get('?price=max&maxPrice=10.50&currency=USD');
    assert.equal(r.status,200); assert.equal(r.body.count,2);
    assert.ok(r.body.items.some(x=>x.id===ids.weekly));
    assert.ok(r.body.items.every(x=>x.id!==ids.percent));
    assert.deepEqual((await get('?price=max&maxPrice=0&currency=USD')).body.items.map(x=>x.id),[ids.valid]);
});
test('maximum price never compares different currencies', async () => {
    try {
        await db.query('UPDATE experiences SET currency=$2 WHERE id=$1',[ids.percent,'EUR']);
        assert.equal((await get('?price=max&maxPrice=100&currency=USD')).body.count,2);
        assert.deepEqual((await get('?price=max&maxPrice=100&currency=EUR')).body.items.map(x=>x.id),[ids.percent]);
    } finally { await db.query('UPDATE experiences SET currency=$2 WHERE id=$1',[ids.percent,'USD']); }
});
test('category, price, keyword, area and date combine before limit', async () => {
    const q=new URLSearchParams({window:'date',date:'2026-10-28',timeZone:'America/Denver',areaId:ids.area,categoryId:ids.music,price:'max',maxPrice:'10.50',currency:'USD',q:'family',limit:'1'});
    const r=await get('?'+q);assert.equal(r.status,200);assert.deepEqual(r.body.items.map(x=>x.id),[ids.valid]);
    q.set('price','free');q.delete('maxPrice');q.delete('currency');
    assert.deepEqual((await get('?'+q)).body.items.map(x=>x.id),[ids.valid]);
    q.set('categoryId',ids.unused);assert.equal((await get('?'+q)).body.count,0);
});
test('price combines with proximity and changing filters restores results', async () => {
    try {
        await db.query('UPDATE businesses SET latitude=39.7392, longitude=-104.9903 WHERE id=$1',[ids.business]);
        const r=await get('?latitude=39.7392&longitude=-104.9903&radiusMiles=10&price=free&categoryId='+ids.music);
        assert.equal(r.body.count,1);assert.equal(r.body.items[0].id,ids.valid);
        assert.equal((await get()).body.count,3);
    } finally { await db.query('UPDATE businesses SET latitude=NULL, longitude=NULL WHERE id=$1',[ids.business]); }
});
test('malformed price requests return structured 400 responses', async () => {
    for(const query of ['?price=cheap','?price=max&maxPrice=-1&currency=USD','?price=max&maxPrice=10','?price=free&maxPrice=0']){
        const r=await get(query);assert.equal(r.status,400);assert.ok(r.body.error.code);
    }
});

test('category endpoint returns selectable category IDs and names', async () => {
    const response=await fetch(url.replace('/experiences','/categories'));
    const body=await response.json();
    assert.equal(response.status,200);assert.equal(body.count,3);
    assert.deepEqual(body.items.map(x=>x.name),['Food','Music','Unused']);
    const music=body.items.find(x=>x.name==='Music');
    assert.equal((await get('?categoryId='+music.id)).body.count,2);
});
test('category endpoint hides database failures', async () => {
    const app=express();app.use('/categories',createCategoryRouter({pool:{async query(){throw Error('private database failure');}},logger}));
    const local=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
        const response=await fetch(`http://127.0.0.1:${local.address().port}/categories`);
        const body=await response.json();assert.equal(response.status,500);
        assert.equal(body.error.code,'CATEGORIES_FETCH_FAILED');assert.ok(!JSON.stringify(body).includes('private'));
    } finally { await new Promise(resolve=>local.close(resolve)); }
});
test('Home today limit returns twelve current/upcoming results and refresh reevaluates the clock', async () => {
    const records=[];
    try {
        for(let n=0;n<15;n++) records.push(await addExperience('Today refresh fixture '+n));
        const first=await discoverExperiences(db,{window:'today',limit:'12',timeZone:'America/Denver'},clock,logger);
        assert.equal(first.items.length,12);assert.equal(first.hasMore,true);
        assert.ok(first.items.every(x=>x.nextOccurrence.status==='UPCOMING'));
        const later=await discoverExperiences(db,{window:'today',limit:'12',timeZone:'America/Denver'},'2026-10-29T04:00:00Z',logger);
        assert.equal(later.count,0);
    } finally { for(const id of records)await db.query('DELETE FROM experiences WHERE id=$1',[id]); }
});
