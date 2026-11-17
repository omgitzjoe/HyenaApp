const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createVenueLookup, parsePlaces, matches } = require('../services/venueLookup');
function fixture() {
    const cache = new Map();
    let requests = 0;
    const pool = { async query(sql,args) {
        if (sql.startsWith('SELECT')) return {rows:cache.has(args[0])?[{results:cache.get(args[0])}]:[]};
        cache.set(args[0],JSON.parse(args[1]));
        return {rows:[]};
    } };
    const data = {features:[{
        geometry:{coordinates:[-112.0339,43.4917]},
        properties:{name:'Local Museum',street:'North Main Street',housenumber:'100',city:'Idaho Falls',osm_key:'tourism'}
    },{
        geometry:{coordinates:[-116.2,43.615]},properties:{name:'Distant Museum',city:'Boise'}
    }]};
    const service = createVenueLookup({pool,fetcher:async()=>{requests++;return Response.json(data);},pause:async()=>{}});
    return {service,requests:()=>requests};
}
test('free lookup caches results and excludes locations beyond 100 miles', async()=>{
    const {service,requests}=fixture();
    assert.equal((await service.search('Local Museum')).length,1);
    assert.equal((await service.search('Local Museum')).length,1);
    assert.equal(requests(),1);
    assert.deepEqual(await service.search('New venue',{budget:{remaining:0}}),[]);
    assert.equal(requests(),1);
});
test('automatic address matching requires a specific unique local match', async()=>{
    const {service}=fixture();
    const result=await service.resolve({name:'Something',address:'100 N Main St',city:'Idaho Falls'});
    assert.equal(result.latitude,43.4917);
    assert.equal(await service.resolve({name:'Unknown',address:'200 N Main St',city:'Idaho Falls'}),null);
    assert.equal(await service.resolve({name:'Local Museum',address:'100 N Main St',city:'Rexburg'}),null);
});
test('coordinate input bypasses provider lookup and provider failure is explicit', async()=>{
    const {service,requests}=fixture();
    const venue={proposal:{name:'Park',address:'1 Park St',city:'Idaho Falls',latitude:43.49,longitude:-112.03}};
    assert.deepEqual(await service.venue(venue),venue);
    assert.equal(requests(),0);
    assert.equal(matches({city:'Idaho Falls',house:'100',street:'North Main Street'},{address:'100 N Main St',city:'Idaho Falls'}),true);
    assert.deepEqual(parsePlaces({features:[]}),[]);
});
