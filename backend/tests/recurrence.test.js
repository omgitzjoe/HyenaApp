const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findOccurrence, evaluateCandidates } = require('../services/recurrence');
const { parseDiscoveryQuery, DiscoveryQueryError } = require('../validation/discovery');
const now = '2026-10-28T18:00:00Z';
const base = {
    id: 'a', title: 'Event', scheduleKind: 'ONCE', startDate: '2026-10-28', endDate: '2026-10-28',
    startTime: '17:00:00', endTime: '21:00:00', endsNextDay: false, timeZone: 'America/Denver', weekdays: []
};
const filters = (window = 'today', date = null, limit = 20) => ({ window, date, limit });
const occurrence = (changes = {}, window = 'today', clock = now, date = null) => findOccurrence({ ...base, ...changes }, filters(window, date), clock);

test('today includes an upcoming event and computes venue-local instants', () => {
    assert.deepEqual(occurrence(), { startsAt: '2026-10-28T23:00:00Z', endsAt: '2026-10-29T03:00:00Z', timeZone: 'America/Denver', localDate: '2026-10-28', status: 'UPCOMING' });
});
test('today excludes expired one-time events', () => assert.equal(occurrence({ startTime: '09:00', endTime: '10:00' }), null));
test('today excludes tomorrow', () => assert.equal(occurrence({ startDate: '2026-10-29', endDate: '2026-10-29' }), null));
test('today excludes a historical one-time event', () => assert.equal(occurrence({ startDate: '2020-01-01', endDate: '2020-01-01' }), null));
test('tonight includes exact 17:00 start', () => assert.ok(occurrence({}, 'tonight')));
test('tonight excludes exact 17:00 end', () => assert.equal(occurrence({ startTime: '16:00', endTime: '17:00' }, 'tonight'), null));
test('tonight includes an event already running when evening starts', () => assert.ok(occurrence({ startTime: '16:00', endTime: '18:00' }, 'tonight')));
test('now excludes upcoming events', () => assert.equal(occurrence({}, 'now'), null));
test('now includes exact start', () => assert.equal(occurrence({ startTime: '12:00', endTime: '13:00' }, 'now').status, 'ONGOING'));
test('now excludes exact end', () => assert.equal(occurrence({ startTime: '11:00', endTime: '12:00' }, 'now'), null));
test('today includes yesterday overnight until its end', () => {
    const result = occurrence({ startDate: '2026-10-27', endDate: '2026-10-27', startTime: '23:00', endTime: '01:00', endsNextDay: true }, 'today', '2026-10-28T06:30:00Z');
    assert.equal(result.localDate, '2026-10-27');
    assert.equal(result.status, 'ONGOING');
});
test('overnight event expires exactly at end', () => assert.equal(occurrence({ startDate: '2026-10-27', endDate: '2026-10-27', startTime: '23:00', endTime: '01:00', endsNextDay: true }, 'now', '2026-10-28T07:00:00Z'), null));
test('weekly weekdays match ISO Monday=1 to Sunday=7', () => {
    assert.ok(occurrence({ scheduleKind: 'WEEKLY', endDate: null, weekdays: [1, 3, 5] }));
    assert.equal(occurrence({ scheduleKind: 'WEEKLY', endDate: null, weekdays: [2] }), null);
});
test('weekly future start is not active today', () => assert.equal(occurrence({ scheduleKind: 'WEEKLY', startDate: '2026-12-01', endDate: null, weekdays: [3] }), null));
test('weekly final start date is inclusive', () => assert.ok(occurrence({ scheduleKind: 'WEEKLY', startDate: '2026-01-01', endDate: '2026-10-28', weekdays: [3] })));
test('expired weekly date range is excluded', () => assert.equal(occurrence({ scheduleKind: 'WEEKLY', startDate: '2026-01-01', endDate: '2026-10-27', weekdays: [3] }), null));
test('weekly overnight honors yesterday weekday and inclusive last start date', () => assert.ok(occurrence({ scheduleKind: 'WEEKLY', startDate: '2026-01-01', endDate: '2026-10-27', weekdays: [2], startTime: '23:00', endTime: '01:00', endsNextDay: true }, 'now', '2026-10-28T06:30:00Z')));
test('selected past date includes expired occurrence with EXPIRED status', () => assert.equal(occurrence({ startDate: '2020-01-01', endDate: '2020-01-01' }, 'date', now, '2020-01-01').status, 'EXPIRED'));
test('today is evaluated in venue time zone, not server date', () => {
    assert.ok(occurrence({ timeZone: 'Asia/Tokyo', startDate: '2026-10-29', endDate: '2026-10-29', startTime: '10:00', endTime: '12:00' }));
    assert.equal(occurrence({ startDate: '2026-10-29', endDate: '2026-10-29', startTime: '10:00', endTime: '12:00' }), null);
});
test('spring gap moves nonexistent local time forward by gap', () => {
    const r = occurrence({ startDate: '2026-03-08', endDate: '2026-03-08', startTime: '02:15', endTime: '03:45' }, 'date', now, '2026-03-08');
    assert.equal(r.startsAt, '2026-03-08T09:15:00Z');
    assert.equal(r.endsAt, '2026-03-08T09:45:00Z');
});
test('fall overlap chooses earlier start and later end', () => {
    const r = occurrence({ startDate: '2026-11-01', endDate: '2026-11-01', startTime: '01:15', endTime: '01:45' }, 'date', now, '2026-11-01');
    assert.equal(r.startsAt, '2026-11-01T07:15:00Z');
    assert.equal(r.endsAt, '2026-11-01T08:45:00Z');
});
test('weekly local wall time survives offset transition', () => {
    const weekly = { scheduleKind: 'WEEKLY', startDate: '2026-01-01', endDate: null, weekdays: [7] };
    assert.equal(occurrence(weekly, 'date', now, '2026-10-25').startsAt, '2026-10-25T23:00:00Z');
    assert.equal(occurrence(weekly, 'date', now, '2026-11-01').startsAt, '2026-11-02T00:00:00Z');
});
test('nonpositive interval after gap resolution is omitted', () => assert.equal(occurrence({ startDate: '2026-03-08', endDate: '2026-03-08', startTime: '02:30', endTime: '03:15' }, 'date', now, '2026-03-08'), null));
test('full local-day interval chooses earliest matching occurrence once per listing', () => {
    const r = occurrence({ scheduleKind: 'WEEKLY', startDate: '2026-01-01', endDate: null, weekdays: [1,2,3,4,5,6,7], startTime: '08:00', endTime: '08:00', endsNextDay: true }, 'now', '2026-10-28T12:00:00Z');
    assert.equal(r.localDate, '2026-10-27');
});
test('fractional-second ordering uses instants rather than lexical timestamps', () => {
    const r = evaluateCandidates([{ ...base, id: 'late', startTime: '17:00:00.5' }, { ...base, id: 'early' }], filters(), now);
    assert.deepEqual(r.items.map(x => x.id), ['early', 'late']);
});
test('filtering happens before result limit, with deterministic tie-breaks', () => {
    const expired = Array.from({length:30}, (_,i)=>({...base,id:`expired-${i}`,startDate:'2020-01-01',endDate:'2020-01-01'}));
    const r = evaluateCandidates([...expired, {...base,id:'b'}, {...base,id:'a'}], filters('today',null,1),now);
    assert.equal(r.items[0].id,'a'); assert.equal(r.count,1); assert.equal(r.hasMore,true);
});
test('all dates explicitly retains expired schedules', () => {
    const r = evaluateCandidates([{...base,startDate:'2020-01-01',endDate:'2020-01-01'}],filters('all'),now);
    assert.equal(r.count,1); assert.equal(r.items[0].nextOccurrence.status,"EXPIRED");
});
test('one invalid zone does not break the feed', () => {
    const warnings=[];
    const r=evaluateCandidates([{...base,id:'invalid',timeZone:'Not/AZone'},base],filters(),now,id=>warnings.push(id));
    assert.equal(r.count,1); assert.deepEqual(warnings,['invalid']);
});
test('query defaults and trimming',()=>assert.deepEqual(parseDiscoveryQuery({q:' music '}),{search:'music',window:'today',date:null,timeZone:null,proximity:null,limit:20,categoryIds:[],categoryId:null,priceMode:"any",maxPrice:null,currency:null}));
for (const [name,query] of Object.entries({
    'invalid window':{window:'year'}, 'window array':{window:['today']}, 'missing selected date':{window:'date'},
    'invalid calendar date':{window:'date',date:'2026-02-30'}, 'date without date window':{date:'2026-10-28'},
    'query array':{q:['music']}, 'too-long query':{q:'a'.repeat(101)}, 'zero limit':{limit:'0'},
    'too-large limit':{limit:'101'}, 'fractional limit':{limit:'2.5'}, 'limit array':{limit:['20']},
    'invalid area':{areaId:'bad'}, 'invalid category':{categoryId:'bad'}, 'unsupported cursor':{cursor:'abc'}
})) test(`rejects ${name}`,()=>assert.throws(()=>parseDiscoveryQuery(query),DiscoveryQueryError));

test('viewer tonight uses Denver evening rather than New York evening', () => {
    const event = { ...base, timeZone: 'America/New_York', startTime: '18:00', endTime: '19:00' };
    assert.ok(findOccurrence(event, filters('tonight'), now));
    assert.equal(findOccurrence(event, { ...filters('tonight'), timeZone: 'America/Denver' }, now), null);
});
test('viewer date includes following venue calendar day', () => {
    const event = { ...base, timeZone: 'UTC', startDate: '2026-10-29', endDate: '2026-10-29', startTime: '01:00', endTime: '02:00' };
    assert.equal(findOccurrence(event, { ...filters('date', '2026-10-28'), timeZone: 'America/Denver' }, now).startsAt, '2026-10-29T01:00:00Z');
});
test('viewer date handles international date line', () => {
    const event = { ...base, timeZone: 'Pacific/Kiritimati', startDate: '2026-10-29', endDate: '2026-10-29', startTime: '12:00', endTime: '13:00' };
    assert.ok(findOccurrence(event, { ...filters('date', '2026-10-28'), timeZone: 'Pacific/Honolulu' }, now));
});
test('now is independent of viewer time zone', () => {
    const event = { ...base, timeZone: 'UTC', startTime: '17:00', endTime: '19:00' };
    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Honolulu', 'America/New_York']) {
        assert.equal(findOccurrence(event, { ...filters('now'), timeZone }, now).status, 'ONGOING');
    }
});
test('viewer midnight excludes exact end boundary', () => {
    const event = { ...base, timeZone: 'UTC', startTime: '05:00', endTime: '06:00' };
    assert.equal(findOccurrence(event, { ...filters('date', '2026-10-28'), timeZone: 'America/Denver' }, now), null);
});
test('proximity defaults to ten miles and accepts zero coordinates', () => {
    assert.deepEqual(parseDiscoveryQuery({ latitude: '0', longitude: '0' }).proximity, { latitude: 0, longitude: 0, radiusMiles: 10 });
});
for (const query of [
    { latitude: '91', longitude: '0' }, { latitude: '0', longitude: '-181' },
    { latitude: 'NaN', longitude: '0' }, { latitude: '', longitude: '0' },
    { latitude: '0' }, { radiusMiles: '10' }, { latitude: ['0'], longitude: '0' },
    { latitude: '0', longitude: '0', radiusMiles: '0' }, { latitude: '0', longitude: '0', radiusMiles: '101' },
    { latitude: '0', longitude: '0', areaId: '00000000-0000-0000-0000-000000000000' },
    { timeZone: 'Mars/Anywhere' }, { timeZone: ['UTC'] }, { timeZone: '+02:00' }
]) test(`rejects malformed location/time zone ${JSON.stringify(query)}`, () => assert.throws(() => parseDiscoveryQuery(query), DiscoveryQueryError));

test('maximum price preserves decimal precision and requires a currency', () => {
    const result = parseDiscoveryQuery({price:'max',maxPrice:'10.50',currency:'USD'});
    assert.equal(result.maxPrice,'10.50'); assert.equal(result.currency,'USD'); assert.equal(result.priceMode,'max');
    assert.equal(parseDiscoveryQuery({price:'max',maxPrice:'0',currency:'USD'}).maxPrice,'0');
    assert.equal(parseDiscoveryQuery({price:'max',maxPrice:'99999999.99',currency:'CAD'}).maxPrice,'99999999.99');
});
for (const query of [
    {price:'cheap'}, {price:['free']}, {price:'max'}, {price:'max',maxPrice:'10'},
    {price:'max',maxPrice:'10',currency:'usd'}, {price:'max',maxPrice:'10',currency:'US'},
    {price:'max',maxPrice:'10',currency:['USD']}, {price:'max',maxPrice:['10'],currency:'USD'},
    {price:'free',maxPrice:'10'}, {currency:'USD'}, {maxPrice:'10'},
    ...['-1','NaN','Infinity','1e3','0x10','10.001','100000000','', ' ', '.5','10.'].map(maxPrice=>({price:'max',maxPrice,currency:'USD'}))
]) test(`rejects invalid price ${JSON.stringify(query)}`,()=>assert.throws(()=>parseDiscoveryQuery(query),DiscoveryQueryError));
