const { createHash, randomUUID } = require('node:crypto');
const ICAL = require('ical.js');
const { Temporal } = require('@js-temporal/polyfill');
const { parseSubmission, scheduleBounds } = require('../validation/submission');
const { submitEvent } = require('./submissions');
const { ReviewError } = require('./publishExperience');
const { venueTimeZone } = require('./venueLocation');

const zone = 'America/Denver';
const civicTags = new Set(['closure', 'official business', 'city council', 'trash pickup', 'garbage schedule']);
const civicTitle = /\b(?:city hall closed|offices? closed|city council (?:meeting|work session)|parking restrictions|garbage schedule)\b/i;
const holidayTitle = /^(?:happy )?(?:new year'?s day|memorial day|juneteenth|independence day|4th of july|labor day|veteran(?:s'?|'s) day|thanksgiving(?: day)?|christmas(?: day| eve)?|president(?:s'?|'s) day|martin luther king(?: jr\.?)? day)(?:[.!])?$/i;

function isCivicNotice(title, tags) {
    return civicTitle.test(title || '') || holidayTitle.test(String(title || '').trim()) ||
        tags.some(tag => civicTags.has(String(tag).trim().toLowerCase()));
}
const sources = {
    parks: {
        name: 'Idaho Falls Parks & Recreation',
        city: 'Idaho Falls',
        page: 'https://www.idahofallsidaho.gov/calendar.aspx?CID=26',
        feed: 'https://www.idahofallsidaho.gov/common/modules/iCalendar/iCalendar.aspx?catID=26&feed=calendar'
    },
    rexburg: {
        name: 'City of Rexburg',
        city: 'Rexburg',
        page: 'https://www.rexburg.org/events',
        feed: 'https://thrillshare-cmsv2.services.thrillshare.com/api/v4/o/21649/cms/events?locale=en&page_no=1',
        json: true
    }
};

function requestId(source, id) {
    const hash = createHash('sha256').update(JSON.stringify([source, id])).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function calendarTime(event, key) {
    const property = event.getFirstProperty(key);
    const value = property?.getFirstValue();
    if (!value) return null;
    const raw = value.toString();
    if (value.isDate) return Temporal.PlainDate.from(raw).toZonedDateTime(zone);
    if (raw.endsWith('Z')) return Temporal.Instant.from(raw).toZonedDateTimeISO(zone);
    return Temporal.PlainDateTime.from(raw).toZonedDateTime(property.getParameter('tzid') || zone)
        .withTimeZone(zone);
}

function calendarRows(text) {
    const calendar = new ICAL.Component(ICAL.parse(text));
    if (calendar.name !== 'vcalendar') throw Error('Expected an iCalendar feed.');
    return calendar.getAllSubcomponents('vevent').map(event => {
        const get = key => event.getFirstPropertyValue(key);
        const row = {
            id: String(get('uid') || ''), title: get('summary'), venue: get('location'),
            url: get('url'), cancelled: String(get('status')).toUpperCase() === 'CANCELLED',
            notice: isCivicNotice(get('summary'), []),
            recurring: ['rrule', 'rdate', 'recurrence-id'].some(key => event.hasProperty(key))
        };
        try {
            row.allDay = get('dtstart')?.isDate === true;
            row.start = calendarTime(event, 'dtstart');
            row.end = calendarTime(event, 'dtend') || (row.allDay ? row.start?.add({ days: 1 }) : null);
        } catch { /* Unrecognized date/time is displayed as a review issue. */ }
        return row;
    });
}

function rexburgRows(text) {
    const { events } = JSON.parse(text);
    if (!Array.isArray(events)) throw Error('Expected Rexburg event records.');
    return events.filter(event => event && /^\d+$/.test(String(event.id))).map(event => {
        const row = {
            id: String(event.id), title: event.title, venue: event.venue || event.address,
            url: `${sources.rexburg.page}?id=${event.id}`, allDay: event.all_day === true,
            latitude: event.latitude, longitude: event.longitude,
            cancelled: /\bcancell?ed\b/i.test(event.title || ''),
            notice: isCivicNotice(event.title, Array.isArray(event.filter_name) ? event.filter_name : [])
        };
        try {
            row.start = Temporal.Instant.from(event.start_at).toZonedDateTimeISO(zone);
            row.end = Temporal.Instant.from(event.end_at).toZonedDateTimeISO(zone);
            if (row.allDay && Temporal.ZonedDateTime.compare(row.start, row.end) === 0) {
                row.end = row.start.add({ days: 1 });
            }
        } catch { /* Leave missing or invalid dates for review. */ }
        return row;
    });
}

function eventSchedule(row) {
    if (!row.start || !row.end || Temporal.ZonedDateTime.compare(row.end, row.start) <= 0) return null;
    const day = row.start.toPlainDate();
    const endDay = row.end.toPlainDate();
    const overnight = !day.equals(endDay);
    const startTime = row.start.toPlainTime().toString({ smallestUnit: 'second' });
    const endTime = row.end.toPlainTime().toString({ smallestUnit: 'second' });
    if (row.allDay ? !day.add({ days: 1 }).equals(endDay) :
        overnight && (!day.add({ days: 1 }).equals(endDay) || endTime > startTime)) return null;
    return {
        kind: 'ONCE', startDate: day.toString(), endDate: day.toString(),
        startTime: row.allDay ? '00:00:00' : startTime,
        endTime: row.allDay ? '23:59:00' : endTime,
        endsNextDay: !row.allDay && overnight, timeZone: zone, allDay: row.allDay
    };
}

function normalize(source, rows, now) {
    const from = Temporal.Instant.from(now.toISOString());
    const until = from.toZonedDateTimeISO(zone).add({ days: 60 }).toInstant();
    const seen = new Set();
    const items = [];
    for (const row of rows) {
        if (!row.id || seen.has(row.id)) continue;
        seen.add(row.id);
        if (row.end && Temporal.Instant.compare(row.end.toInstant(), from) <= 0 ||
            row.start && Temporal.Instant.compare(row.start.toInstant(), until) >= 0) continue;
        const title = String(row.title || '').trim().slice(0, 200);
        const venue = String(row.venue || '').trim().slice(0, 300);
        const schedule = eventSchedule(row);
        let url = sources[source].page;
        try {
            const candidate = new URL(row.url);
            if (candidate.origin === new URL(url).origin && candidate.protocol === 'https:') url = candidate.href;
        } catch { /* The feed's calendar page is the attribution fallback. */ }
        const issue = row.cancelled || /\bcancell?ed\b/i.test(title) ? 'Cancelled by the source' :
            row.notice ? 'City notice or closure' :
            row.recurring ? 'Recurring series needs manual review' :
            !title || !schedule ? 'Missing or unsupported schedule' : null;
        const coordinate = value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value))
            ? Number(value) : null;
        items.push({
            id: requestId(source, row.id), title: title || 'Untitled event', venue, schedule, url, issue,
            city: sources[source].city, latitude: coordinate(row.latitude), longitude: coordinate(row.longitude)
        });
    }
    return items.sort((a, b) => (a.schedule?.startDate || '9999').localeCompare(b.schedule?.startDate || '9999') ||
        (a.schedule?.startTime || '').localeCompare(b.schedule?.startTime || ''));
}

async function fetchText(fetcher, url) {
    const response = await fetcher(url, {
        signal: AbortSignal.timeout(7000), redirect: 'error',
        headers: { 'User-Agent': 'HyenaApp event calendar preview' }
    });
    if (!response.ok || !response.body) throw Error(`Feed returned HTTP ${response.status}.`);
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > 2_000_000) throw Error('Feed exceeds the preview size limit.');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function createEventImports({ pool, fetcher = fetch, clock = () => new Date() }) {
    const cache = new Map();
    let runningSync;
    function load(source) {
        const previous = cache.get(source);
        if (previous && previous.expires > Date.now()) return previous.promise;
        const config = sources[source];
        const promise = (async () => {
            const text = await fetchText(fetcher, config.feed);
            const rows = config.json ? rexburgRows(text) : calendarRows(text);
            const format = config.json ? 'Public calendar JSON' : 'iCalendar';
            return { name: config.name, format, records: rows.length, items: normalize(source, rows, clock()) };
        })();
        const entry = { expires: Date.now() + 120_000, promise };
        cache.set(source, entry);
        promise.catch(() => { if (cache.get(source) === entry) cache.delete(source); });
        return promise;
    }
    async function preview() {
        const result = await Promise.allSettled(Object.keys(sources).map(load));
        const feeds = Object.keys(sources).map((source, i) => result[i].status === 'fulfilled'
            ? { source, ...result[i].value }
            : { source, name: sources[source].name, error: 'Feed temporarily unavailable.', items: [] });
        const ids = feeds.flatMap(feed => feed.items.map(item => item.id));
        if (!ids.length) return feeds;
        const { rows } = await pool.query(
            'SELECT client_request_id AS id, status, payload FROM event_submissions WHERE client_request_id=ANY($1::uuid[])',
            [ids]
        );
        const imported = new Map(rows.map(row => [row.id, row]));
        for (const feed of feeds) {
            const count = feed.items.length;
            feed.items = feed.items.filter(item => {
                const previous = imported.get(item.id);
                return previous?.status !== 'REJECTED' && (!item.issue || previous);
            }).map(item => {
                const previous = imported.get(item.id);
                if (!previous) return item;
                const old = previous.payload.event;
                const changed = item.schedule && ['startDate', 'startTime', 'endTime', 'endsNextDay', 'allDay']
                    .some(key => (old.schedule[key] ?? false) !== item.schedule[key]);
                return { ...item, queuedStatus: previous.status,
                    issue: item.issue || (changed || old.title !== item.title ? 'Source details changed. Review the existing submission.' : null) };
            });
            feed.hidden = count - feed.items.length;
        }
        return feeds;
    }
    async function queue({ source, id, venue, categoryId }) {
        const feed = await load(source);
        const item = feed.items.find(event => event.id === id);
        if (!item || item.issue) throw new ReviewError(400, 'IMPORT_NOT_READY', 'This event needs manual review before it can be queued.');
        const parsed = parseSubmission({
            clientRequestId: id, venue,
            event: importEvent(feed, item, [categoryId])
        });
        if (!parsed.success) throw new ReviewError(400, 'IMPORT_INVALID', 'Check the category, venue details, coordinates, and event schedule.');
        const location = venue.proposal || (await pool.query(
            'SELECT latitude, longitude FROM businesses WHERE id=$1 AND is_active', [venue.businessId]
        )).rows[0];
        if (!location || location.latitude == null || location.longitude == null) {
            throw new ReviewError(400, 'IMPORT_VENUE_REQUIRED', 'Choose a local venue with verified coordinates.');
        }
        const schedule = parsed.data.payload.event.schedule;
        const original = scheduleBounds(schedule);
        const local = scheduleBounds({ ...schedule, timeZone: venueTimeZone(location) });
        if (local.startsAt !== original.startsAt || local.endsAt !== original.endsAt) {
            throw new ReviewError(400, 'IMPORT_VENUE_TIME_ZONE', 'Choose a venue in the event’s local time zone.');
        }
        return submitEvent(pool, parsed.data, clock());
    }
    function importEvent(feed, item, categoryIds) {
        return {
            title: item.title, description: `Event listed by ${feed.name}. See the source for details.`,
            type: 'EVENT', priceAmount: null, sourceUrl: item.url, categoryIds, schedule: item.schedule
        };
    }
    function proposal(item) {
        return { name: item.venue || 'Venue to verify', address: item.venue || 'Address to verify',
            city: item.city, latitude: item.latitude, longitude: item.longitude };
    }
    async function dismiss({ source, id }, username) {
        const feed = await load(source);
        const item = feed.items.find(event => event.id === id);
        if (!item || !item.schedule) throw new ReviewError(404, 'IMPORT_NOT_FOUND', 'Refresh the feed to find this event.');
        const payload = { venue: { proposal: proposal(item) }, event: importEvent(feed, item, []) };
        const result = await pool.query(
            `INSERT INTO event_submissions (id, client_request_id, payload, status, reviewed_by, reviewed_at, review_note)
             VALUES ($1, $2, $3::jsonb, 'REJECTED', $4, CURRENT_TIMESTAMP, 'Dismissed from event feed')
             ON CONFLICT (client_request_id) DO UPDATE SET status='REJECTED', reviewed_by=EXCLUDED.reviewed_by,
                 reviewed_at=EXCLUDED.reviewed_at, review_note=EXCLUDED.review_note
             WHERE event_submissions.status='PENDING' RETURNING status`,
            [randomUUID(), id, JSON.stringify(payload), username]
        );
        if (result.rows.length) return;
        const existing = await pool.query('SELECT status FROM event_submissions WHERE client_request_id=$1', [id]);
        if (existing.rows[0]?.status !== 'REJECTED') {
            throw new ReviewError(409, 'IMPORT_ALREADY_PUBLISHED', 'This event was published. Review the public listing separately.');
        }
    }
    async function importEligible() {
        const feeds = await preview();
        const { rows } = await pool.query(
            "SELECT id FROM categories WHERE slug IN ('community','hyena-seed-community') ORDER BY slug LIMIT 1"
        );
        const categoryId = rows[0]?.id;
        const summary = { queued: 0, needsReview: 0, unavailable: feeds.filter(feed => feed.error).length };
        for (const feed of feeds) {
            for (const item of feed.items) {
                if (item.queuedStatus || item.issue) continue;
                // Generic city pins are insufficient. Require a street address and source coordinates.
                if (!categoryId || !/\b\d+\s+\S/.test(item.venue.split(',')[0]) ||
                    item.latitude == null || item.longitude == null) {
                    summary.needsReview++;
                    continue;
                }
                try {
                    const result = await queue({ source: feed.source, id: item.id, categoryId,
                        venue: { proposal: proposal(item) } });
                    if (result.created) summary.queued++;
                } catch (error) {
                    if (!(error instanceof ReviewError)) throw error;
                    summary.needsReview++;
                }
            }
        }
        return summary;
    }
    function sync() {
        if (!runningSync) runningSync = importEligible().finally(() => { runningSync = null; });
        return runningSync;
    }
    return { preview, queue, dismiss, sync };
}

module.exports = { createEventImports, calendarRows, rexburgRows, normalize, sources };
