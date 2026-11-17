const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calendarRows, normalize } = require('../services/eventImports');

test('calendar imports decode folded titles, UTC times, and exclusive all-day ends', () => {
    const calendar = [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'BEGIN:VEVENT', 'UID:test-utc', 'SUMMARY:An evening of',
        '  music', 'DTSTART:20261111T010000Z', 'DTEND:20261111T020000Z',
        'LOCATION:City hall', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:test-all-day', 'SUMMARY:Festival',
        'DTSTART;VALUE=DATE:20261112', 'DTEND;VALUE=DATE:20261113', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:test-series', 'SUMMARY:Recurring class',
        'DTSTART;TZID=America/Denver:20261114T190000',
        'DTEND;TZID=America/Denver:20261114T200000', 'RRULE:FREQ=WEEKLY', 'END:VEVENT',
        'END:VCALENDAR', ''
    ].join('\r\n');
    const items = normalize('parks', calendarRows(calendar), new Date('2026-11-06T17:00:00Z'));
    assert.equal(items[0].title, 'An evening of music');
    assert.equal(items[0].schedule.startDate, '2026-11-10');
    assert.equal(items[0].schedule.startTime, '18:00:00');
    assert.equal(items[1].schedule.allDay, true);
    assert.equal(items[1].schedule.endDate, '2026-11-12');
    assert.equal(items[2].issue, 'Recurring series needs manual review');
});

test('structured local feeds decode HTML and use venue city to reject out-of-region events', () => {
    const { tribeRows } = require('../services/localEventSources');
    const event = {
        id: 100, title: 'Arts &amp; crafts', description: '<p>Make something.</p>',
        url: 'https://museumofidaho.org/event/arts', start_date: '2026-11-20 18:00:00',
        end_date: '2026-11-20 19:30:00', timezone: 'America/Boise',
        venue: { venue: 'Museum of Idaho', address: '200 N Eastern Ave', city: 'Idaho Falls' }
    };
    const rows = tribeRows(JSON.stringify({events:[event,{...event,id:101,venue:{...event.venue,city:'Boise'}}]}));
    const items = normalize('museum', rows, new Date('2026-11-17T19:00:00Z'));
    assert.equal(items.length,1);
    assert.equal(items[0].title,'Arts & crafts');
    assert.equal(items[0].schedule.startTime,'18:00:00');
    assert.equal(items[0].city,'Idaho Falls');
    assert.equal(items[0].address,'200 N Eastern Ave');
    assert.equal(items[0].description,'Make something.');
});

test('coordinate radius filtering excludes distant venues even when the feed is local', () => {
    const { rexburgRows } = require('../services/eventImports');
    const base = {id:1,title:'Show',venue:'100 Main St',start_at:'2026-11-20T18:00:00-07:00',end_at:'2026-11-20T19:00:00-07:00'};
    const rows = rexburgRows(JSON.stringify({events:[
        {...base,latitude:43.82,longitude:-111.79},
        {...base,id:2,latitude:43.615,longitude:-116.2}
    ]}));
    assert.equal(normalize('rexburg',rows,new Date('2026-11-17T19:00:00Z')).length,1);
});

test('library HTML parser reads dates and deduplicates repeated month cells by stable occurrence ID', () => {
    const { simpleCalendarRows } = require('../services/localEventSources');
    const html = `<li class="simcal-event">
      <span class="simcal-event-title">Story time</span>
      <span itemprop="startDate" content="2026-11-20T10:00:00-07:00"></span>
      <span itemprop="endDate" content="2026-11-20T11:00:00-07:00"></span>
      <a href="https://www.google.com/calendar/event?eid=one">Details</a>
    </li>`;
    const items = normalize('madisonLibrary',simpleCalendarRows(html+html),new Date('2026-11-17T19:00:00Z'));
    assert.equal(items.length,1);
    assert.equal(items[0].schedule.startTime,'10:00:00');
});
