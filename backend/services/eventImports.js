const { createHash, randomUUID } = require('node:crypto');
const ICAL = require('ical.js');
const { Temporal } = require('@js-temporal/polyfill');
const { parseSubmission, scheduleBounds } = require('../validation/submission');
const { createVenueLookup } = require('./venueLookup');
const { submitEvent, reviewSubmission } = require('./submissions');
const { ReviewError } = require('./publishExperience');
const { additionalSources, libraryFallback, tribeRows, simpleCalendarRows } = require('./localEventSources');
const { venueTimeZone, distanceMiles } = require('./venueLocation');

const zone = 'America/Denver';
const civicTags = new Set(['closure', 'official business', 'city council', 'trash pickup', 'garbage schedule']);
const civicTitle = /\b(?:city hall closed|offices? closed|city council (?:meeting|work session|work meeting)|parking restrictions|garbage schedule)\b/i;
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
    },
    ...additionalSources
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
        const geo = get('geo');
        const row = {
            latitude:Array.isArray(geo)?geo[0]:null,longitude:Array.isArray(geo)?geo[1]:null,
            id: String(get('uid') || ''), title: get('summary'), venue: get('location'),
            url: get('url'), cancelled: String(get('status')).toUpperCase() === 'CANCELLED',
            notice: isCivicNotice(get('summary'), []),
            outsideRegion: /\b(?:Meridian|Boise|Twin Falls|Moab|Salt Lake City)\b/i.test(String(get('location') || '')),
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
 if(!row.start)return null;
 const start=row.start.toPlainDate();
 const end=row.end?.toPlainDate();
 if(row.end && Temporal.ZonedDateTime.compare(row.end,row.start)<=0 && !row.allDay)return null;
 return {kind:'ONCE',startDate:start.toString(),endDate:row.allDay && end ? end.subtract({days:1}).toString() : end?.toString() || null,
 startTime:row.allDay?null:row.start.toPlainTime().toString({smallestUnit:'second'}),
 endTime:row.allDay?null:row.end?.toPlainTime().toString({smallestUnit:'second'}) || null,
 allDay:Boolean(row.allDay),timeZone:zone};
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
        if (row.outsideRegion) continue;
        let url = sources[source].page;
        try {
            const candidate = new URL(row.url);
            if ([new URL(url).origin, ...(source === 'parks' ? [new URL(libraryFallback.page).origin] : [])].includes(candidate.origin) && candidate.protocol === 'https:') url = candidate.href;
        } catch { /* The feed's calendar page is the attribution fallback. */ }
        const issue = row.cancelled || /\bcancell?ed\b/i.test(title) ? 'Cancelled by the source' :
            row.notice || isCivicNotice(title, row.tags || []) ? 'City notice or closure' :
            row.recurring ? 'Recurring series needs manual review' :
            !title || !schedule ? 'Missing or unsupported schedule' : null;
        const coordinate = value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value))
            ? Number(value) : null;
        const latitude = coordinate(row.latitude);
        const longitude = coordinate(row.longitude);
        if (latitude != null && Math.abs(latitude) > 90 || longitude != null && Math.abs(longitude) > 180) continue;
        if (latitude != null && longitude != null &&
            distanceMiles({ latitude: 43.4917, longitude: -112.0339 }, { latitude, longitude }) > 100) continue;
        items.push({
            id: requestId(source, row.id), title: title || 'Untitled event', venue, schedule, url, issue,
            city: row.city || sources[source].city, latitude, longitude,
            venueName: row.venueName, address: row.address, description: row.description
        });
    }
    return items.sort((a, b) => (a.schedule?.startDate || '9999').localeCompare(b.schedule?.startDate || '9999') ||
        (a.schedule?.startTime || '').localeCompare(b.schedule?.startTime || ''));
}

async function fetchText(fetcher, url) {
    const response = await fetcher(url, {
        signal: AbortSignal.timeout(12000), redirect: 'error',
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

function createEventImports({ pool, fetcher = fetch, clock = () => new Date(), venueLookup = createVenueLookup({pool}) }) {
    const cache = new Map();
    let runningSync;
    function load(source) {
        const previous = cache.get(source);
        if (previous && previous.expires > Date.now()) return previous.promise;
        const config = sources[source];
        const promise = (async () => {
            async function read(config) {
                const text = await fetchText(fetcher, config.feed);
                const format = config.json ? 'rexburg' : config.format || 'ical';
                const parsers = { rexburg: rexburgRows, tribe: tribeRows, ical: calendarRows, simpleCalendar: simpleCalendarRows };
                const rows = parsers[format](text);
                let truncated = false;
                if (format === 'tribe') {
                    const pages = Math.min(Number(JSON.parse(text.trim()).total_pages) || 1, 3);
                    truncated = Number(JSON.parse(text.trim()).total_pages) > 3;
                    for (let page = 2; page <= pages; page++) {
                        const url = new URL(config.feed);
                        url.searchParams.set('page', String(page));
                        const next = await fetchText(fetcher, url.href);
                        rows.push(...tribeRows(next));
                    }
                }
                return { rows, format, truncated };
            }
            let result;
            let primaryError;
            try { result = await read(config); }
            catch (error) { primaryError = error; }
            let fallback = false;
            if (source === 'parks' && (!result || !result.rows.length)) {
                result = await read(libraryFallback);
                fallback = true;
            }
            if (!result) throw primaryError;
            return {
                name: config.name, format: result.format, records: result.rows.length,
                note: [
                    fallback && (primaryError
                        ? 'City Parks is unavailable. Showing Idaho Falls Public Library events.'
                        : 'City Parks returned no events. Showing Idaho Falls Public Library events.'),
                    result.truncated && 'Preview covers the first 150 upcoming source entries.'
                ].filter(Boolean).join(' ') || null,
                items: normalize(source, result.rows, clock())
            };
        })();
        const entry = { expires: Date.now() + 120_000, promise };
        cache.set(source, entry);
        promise.catch(() => { if (cache.get(source) === entry) cache.delete(source); });
        return promise;
    }
    async function preview({includeImported=false}={}) {
        const result = await Promise.allSettled(Object.keys(sources).map(load));
        const feeds = Object.keys(sources).map((source, i) => result[i].status === 'fulfilled'
            ? { source, ...result[i].value }
            : { source, name: sources[source].name, error: 'Feed temporarily unavailable.', items: [] });
        const ids = feeds.flatMap(feed => feed.items.map(item => item.id));
        if (!ids.length) return feeds;
        const { rows } = await pool.query(
            'SELECT client_request_id AS id, id AS submission_id,status, payload, request_payload,source_snapshot,auto_publish_blocked FROM event_submissions WHERE client_request_id=ANY($1::uuid[])',
            [ids]
        );
        const imported = new Map(rows.map(row => [row.id, row]));
        for (const feed of feeds) {
            const count = feed.items.length;
            feed.items = feed.items.filter(item => {
                const previous = imported.get(item.id);
                return (includeImported ? previous?.status !== 'REJECTED' : !previous) && (!item.issue || item.issue === 'Missing or unsupported schedule' || previous);
            }).map(item => {
                const previous = imported.get(item.id);
                if (!previous) return item;
                const old = previous.payload.event;
                const changed = item.schedule && ['startDate', 'endDate', 'startTime', 'endTime', 'allDay']
                    .some(key => (old.schedule?.[key] ?? null) !== (item.schedule[key] ?? null));
                return { ...item, submissionId:previous.submission_id,sourceSnapshot:previous.source_snapshot,requestPayload:previous.request_payload,storedPayload:previous.payload,queuedStatus: previous.status, autoPublishBlocked:previous.auto_publish_blocked,
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
            clientRequestId: id, venue: await venueLookup.venue(venue),
            event: importEvent(feed, item, [categoryId])
        });
        if (!parsed.success) throw new ReviewError(400, 'IMPORT_INVALID', 'Check the category, venue details, coordinates, and event schedule.');
        const resolvedVenue = parsed.data.payload.venue;
        const location = resolvedVenue.proposal || (await pool.query(
            'SELECT latitude, longitude FROM businesses WHERE id=$1 AND is_active', [resolvedVenue.businessId]
        )).rows[0];
        if (!location) throw new ReviewError(400,'IMPORT_VENUE_REQUIRED','Choose a venue.');
        if (location.latitude != null && location.longitude != null && distanceMiles({ latitude: 43.4917, longitude: -112.0339 }, location) > 100) {
            throw new ReviewError(400, 'IMPORT_OUTSIDE_RADIUS', 'Choose an event venue within 100 miles of Idaho Falls.');
        }
        const schedule = parsed.data.payload.event.schedule;
        const original = scheduleBounds(schedule);
        const local = scheduleBounds({ ...schedule, timeZone: venueTimeZone(location) });
        if (local.startsAt !== original.startsAt || local.endsAt !== original.endsAt) {
            throw new ReviewError(400, 'IMPORT_VENUE_TIME_ZONE', 'Choose a venue in the event’s local time zone.');
        }
        const receipt=await submitEvent(pool, parsed.data, clock(),{sourceKind:'FEED'});
        if(receipt.created)await pool.query('UPDATE event_submissions SET source_snapshot=$2::jsonb WHERE id=$1',[receipt.item.id,JSON.stringify(require('./feedChanges').snapshot(item))]);
        return receipt;
    }
    function importEvent(feed, item, categoryIds) {
        return {
            title: item.title, description: item.description || null,
            type: 'OTHER', priceAmount: null, sourceUrl: item.url, categoryIds, schedule: item.schedule
        };
    }
    function proposal(item) {
        return { name: item.venueName || item.venue || 'Event location', address: item.address || item.venue || null,
            city: item.city, state:'ID', latitude: item.latitude, longitude: item.longitude };
    }
    async function dismiss({ source, id }, username) {
        const feed = await load(source);
        const item = feed.items.find(event => event.id === id);
        if (!item) throw new ReviewError(404, 'IMPORT_NOT_FOUND', 'Refresh the feed to find this event.');
        const payload = { venue: { proposal: proposal(item) }, event: importEvent(feed, item, []) };
        payload.event.schedule = payload.event.schedule || {};
        const result = await pool.query(
            `INSERT INTO event_submissions (id, client_request_id, payload, status, reviewed_by, reviewed_at,source_kind)
             VALUES ($1, $2, $3::jsonb, 'REJECTED', $4, CURRENT_TIMESTAMP, 'FEED')
             ON CONFLICT (client_request_id) DO UPDATE SET status='REJECTED', reviewed_by=EXCLUDED.reviewed_by,
                 reviewed_at=EXCLUDED.reviewed_at
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
        const feeds = await preview({includeImported:true});
        const category = await pool.query(
            "SELECT id FROM categories WHERE slug='other' OR lower(name)='other' ORDER BY slug LIMIT 1"
        );
        const categoryId = category.rows[0]?.id;
        const summary = { accepted:0, queued:0, needsReview:0, duplicates:0, unavailable:feeds.filter(feed=>feed.error).length };
        const budget = {remaining:4};
        for (const feed of feeds) {
            for (const item of feed.items) {
                if(item.submissionId && ['PENDING','APPROVED'].includes(item.queuedStatus)){
                    if(await require('./feedChanges').observe(pool,item))continue;
                }
                if (item.queuedStatus === 'APPROVED' || item.queuedStatus === 'REJECTED' || item.autoPublishBlocked) continue;
                if (item.issue && item.issue !== 'Missing or unsupported schedule') continue;
                if (!item.schedule || item.issue === 'Missing or unsupported schedule' || (!item.venue && !item.venueName && item.latitude == null)) {
                    const payload={venue:{proposal:proposal(item)},event:importEvent(feed,item,categoryId?[categoryId]:[])};
                    payload.event.schedule=payload.event.schedule || {};
                    const added=await pool.query(
                        `INSERT INTO event_submissions(id,client_request_id,payload,source_kind) VALUES($1,$2,$3::jsonb,'FEED')
                         ON CONFLICT(client_request_id) DO NOTHING RETURNING id`,
                        [randomUUID(),item.id,JSON.stringify(payload)]
                    );
                    if (added.rows.length) summary.queued++;
                    summary.needsReview++;
                    continue;
                }
                let venue;
                const address = item.address || item.venue.split(',')[0];
                const matches = await pool.query(
                    `SELECT id,latitude,longitude FROM businesses WHERE is_active AND latitude IS NOT NULL
                     AND longitude IS NOT NULL AND lower(city)=lower($2)
                     AND (lower(regexp_replace(address,'[^a-zA-Z0-9]','','g')) =
                         lower(regexp_replace($1,'[^a-zA-Z0-9]','','g')) OR lower(name)=lower($3)) LIMIT 2`,
                    [address,item.city,item.venueName || item.venue.split(',')[0]]
                );
                if (matches.rows.length === 1 && distanceMiles(
                    {latitude:43.4917,longitude:-112.0339},matches.rows[0]
                ) <= 100) venue = {businessId:matches.rows[0].id};
                else if (item.latitude != null && item.longitude != null) venue={proposal:proposal(item)};
                else {
                    try {
                        const proposed=proposal(item);
                        const resolved=await venueLookup.resolve(proposed,{budget});
                        venue={proposal:resolved || proposed};
                    } catch { /* Lookup outages leave the candidate available for review. */ }
                }
                if (!categoryId) { summary.needsReview++; continue; }
                if (!venue) {
                    // Preserve incomplete source information for admin correction rather than inventing coordinates.
                    const payload={venue:{proposal:proposal(item)},event:importEvent(feed,item,[categoryId])};
                    const added=await pool.query(
                        `INSERT INTO event_submissions(id,client_request_id,payload,source_kind) VALUES($1,$2,$3::jsonb,'FEED')
                         ON CONFLICT(client_request_id) DO NOTHING RETURNING id`,
                        [randomUUID(),item.id,JSON.stringify(payload)]
                    );
                    if (added.rows.length) summary.queued++;
                    summary.needsReview++;
                    continue;
                }
                try {
                    let submission;
                    if (item.queuedStatus === 'PENDING') {
                        const stored=await pool.query('SELECT id FROM event_submissions WHERE client_request_id=$1',[item.id]);
                        submission=stored.rows[0];
                    } else {
                        const result=await queue({source:feed.source,id:item.id,categoryId,venue});
                        submission=result.item;
                    }
                    if (!submission) continue;
                    const reviewed=await reviewSubmission(pool,submission.id,'APPROVED','Automatic feed import',
                        {automatic:true,venue},clock());
                    if (reviewed.status==='APPROVED') summary.accepted++;
                    if (reviewed.duplicateOf) summary.duplicates++;
                } catch (error) {
                    if (!(error instanceof ReviewError)) throw error;
                    summary.needsReview++;
                }
            }
        }
        return summary;
    }
    function sync({ refresh = false } = {}) {
        if (!runningSync) {
            if (refresh) cache.clear();
            runningSync = importEligible().finally(() => { runningSync = null; });
        }
        return runningSync;
    }
    return { preview, queue, dismiss, sync };
}

module.exports = { createEventImports, calendarRows, rexburgRows, normalize, sources };
