const { Temporal } = require('@js-temporal/polyfill');
const cheerio = require('cheerio');

const additionalSources = {
    museum: {
        name: 'Museum of Idaho', city: 'Idaho Falls', page: 'https://museumofidaho.org/events/',
        feed: 'https://museumofidaho.org/wp-json/tribe/events/v1/events?per_page=50', format: 'tribe'
    },
    rexburgChamber: {
        name: 'Rexburg Chamber of Commerce', city: 'Rexburg', page: 'https://rexburgchamber.org/events/',
        feed: 'https://rexburgchamber.org/wp-json/tribe/events/v1/events?per_page=50', format: 'tribe'
    },
    tetonValley: {
        name: 'Teton Valley Welcome Center', city: 'Driggs', page: 'https://welcometetonvalley.org/events/',
        feed: 'https://welcometetonvalley.org/wp-json/tribe/events/v1/events?per_page=50', format: 'tribe'
    },
    lava: {
        name: 'Lava Hot Springs Chamber', city: 'Lava Hot Springs', page: 'https://lavahotsprings.org/events/',
        feed: 'https://lavahotsprings.org/wp-json/tribe/events/v1/events?per_page=50', format: 'tribe'
    },
    isu: {
        name: 'Idaho State University', city: 'Pocatello', page: 'https://www.isu.edu/calendar/',
        feed: 'https://www.trumba.com/calendars/isu_event_calendar.ics', format: 'ical'
    },
    madisonLibrary: {
        name: 'Madison Library District', city: 'Rexburg', page: 'https://www.madisonlib.org/main-calendar/',
        feed: 'https://www.madisonlib.org/main-calendar/', format: 'simpleCalendar'
    }
};

const libraryFallback = {
    name: 'Idaho Falls Public Library', city: 'Idaho Falls', page: 'https://www.ifpl.org/events/',
    feed: 'https://www.ifpl.org/wp-json/tribe/events/v1/events?per_page=50', format: 'tribe'
};
const towns = new Set([
    'idaho falls', 'ammon', 'iona', 'shelley', 'rigby', 'rexburg', 'blackfoot', 'pocatello',
    'chubbuck', 'american falls', 'lava hot springs', 'driggs', 'victor', 'tetonia',
    'st anthony', 'st. anthony', 'ashton', 'island park', 'jackson', 'soda springs'
]);
function cleanText(value) {
    return cheerio.load(String(value || '')).text().replace(/\s+/g, ' ').trim();
}
function tribeRows(text) {
    const data = JSON.parse(text.trim());
    if (!Array.isArray(data.events)) throw Error('Expected a structured event feed.');
    return data.events.map(event => {
        const venue = event.venue || {};
        const title = cleanText(event.title);
        const row = {
            id: String(event.id || ''), title, url: event.url, description: cleanText(event.description).slice(0, 9000),
            venueName: cleanText(venue.venue), address: cleanText(venue.address), city: cleanText(venue.city),
            venue: [cleanText(venue.venue), cleanText(venue.address), cleanText(venue.city)].filter(Boolean).join(', '),
            latitude: venue.geo_lat || venue.latitude, longitude: venue.geo_lng || venue.longitude,
            allDay: event.all_day === true,
            cancelled: event.event_status === 'canceled' || event.event_status === 'cancelled',
            tags: (event.categories || []).map(category => category.name),
            outsideRegion: Boolean(venue.city) && !towns.has(cleanText(venue.city).toLowerCase())
        };
        try {
            const zone = event.timezone || 'America/Denver';
            row.start = Temporal.PlainDateTime.from(event.start_date.replace(' ', 'T')).toZonedDateTime(zone).withTimeZone('America/Denver');
            row.end = Temporal.PlainDateTime.from(event.end_date.replace(' ', 'T')).toZonedDateTime(zone).withTimeZone('America/Denver');
            if (row.allDay) {
                row.start = row.start.startOfDay();
                row.end = row.end.startOfDay().add({ days: 1 });
            }
        } catch { /* Invalid source times are flagged by normalization. */ }
        return row;
    });
}
function simpleCalendarRows(text) {
    const $ = cheerio.load(text);
    const rows = [];
    $('.simcal-event').each((index, element) => {
        const node = $(element);
        const start = node.find('[itemprop="startDate"]').first().attr('content');
        const end = node.find('[itemprop="endDate"]').last().attr('content');
        const link = node.find('a[href*="calendar/event"]').attr('href');
        if (!start || !end || !link) return;
        const row = {
            id: new URL(link).searchParams.get('eid') + ':' + start,
            title: node.find('.simcal-event-title').first().text().trim(),
            venueName: 'Madison Library District', venue: 'Madison Library District, 73 N Center St, Rexburg',
            address: '73 N Center St', city: 'Rexburg',
            url: 'https://www.madisonlib.org/main-calendar/'
        };
        try {
            row.start = Temporal.Instant.from(start).toZonedDateTimeISO('America/Denver');
            row.end = Temporal.Instant.from(end).toZonedDateTimeISO('America/Denver');
        } catch { /* Invalid source times are flagged by normalization. */ }
        rows.push(row);
    });
    return rows;
}
module.exports = { additionalSources, libraryFallback, tribeRows, simpleCalendarRows };
