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
