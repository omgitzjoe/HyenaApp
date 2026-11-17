const { distanceMiles } = require('./venueLocation');
const { ReviewError } = require('./publishExperience');

const center = { latitude: 43.4917, longitude: -112.0339 };
function words(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean)
        .map(word => ({n:'north',s:'south',e:'east',w:'west',st:'street',ave:'avenue',rd:'road',blvd:'boulevard',dr:'drive'}[word] || word)).join(' ');
}
function matches(place, input) {
    if (words(place.city) !== words(input.city)) return false;
    const house = String(input.address || '').match(/^\s*(\d+[a-z]?)/i)?.[1];
    const street = words(String(input.address || '').replace(/^\s*\d+[a-z]?\s*/i,'').split(',')[0]);
    if (house && place.house === house && words(place.street) === street) return true;
    // A unique named point of interest can resolve an address lacking a building number in OSM.
    return Boolean(input.name && words(input.name) === words(place.name) && place.poi &&
        (!house || !place.street || words(place.street) === street));
}
function parsePlaces(data) {
    if (!Array.isArray(data.features)) throw Error('Unexpected venue search response.');
    return data.features.flatMap(feature => {
        const p = feature.properties || {};
        const [longitude, latitude] = feature.geometry?.coordinates || [];
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude)>90 || Math.abs(longitude)>180 ||
            distanceMiles(center,{latitude,longitude})>100) return [];
        const city = p.city || p.town || p.village || '';
        const street = p.street || '';
        const address = [p.housenumber,street].filter(Boolean).join(' ');
        return [{
            name:p.name || address, address, city, state:p.state || null, latitude, longitude,
            street, house:p.housenumber || '', poi:Boolean(p.osm_key && !['place','boundary','highway'].includes(p.osm_key)),
            label:[p.name,address,city,p.state].filter(Boolean).join(', ')
        }];
    });
}
function createVenueLookup({ pool, fetcher=fetch, pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)) }) {
    const inFlight = new Map();
    let queue = Promise.resolve();
    let nextRequest = 0;
    async function search(query, { budget } = {}) {
        const key = query.trim().replace(/\s+/g,' ').toLowerCase().slice(0,250);
        if (key.length<3) return [];
        const cached = await pool.query('SELECT results FROM venue_lookup_cache WHERE query=$1 AND expires_at>CURRENT_TIMESTAMP',[key]);
        if (cached.rows.length) return cached.rows[0].results;
        if (inFlight.has(key)) return inFlight.get(key);
        if (budget && budget.remaining<=0) return [];
        if (budget) budget.remaining--;
        if (inFlight.size>=8) throw new ReviewError(429,'LOOKUP_BUSY','Venue search is busy. Try again shortly.');
        const request = queue.then(async()=>{
            const wait = nextRequest-Date.now();
            if (wait>0) await pause(wait);
            nextRequest=Date.now()+1100;
            const url = new URL('https://photon.komoot.io/api/');
            url.search = new URLSearchParams({q:key,lat:String(center.latitude),lon:String(center.longitude),limit:'8',lang:'en'}).toString();
            const response = await fetcher(url.href,{signal:AbortSignal.timeout(8000),redirect:'error',
                headers:{'User-Agent':'HyenaApp local venue lookup (github.com/omgitzjoe/HyenaApp)'}});
            if (!response.ok) throw new ReviewError(503,'LOOKUP_UNAVAILABLE','Free venue search is temporarily unavailable. Try again or enter coordinates.');
            const text = await response.text();
            if (text.length>100000) throw Error('Venue search response too large.');
            const results = parsePlaces(JSON.parse(text));
            await pool.query(`INSERT INTO venue_lookup_cache(query,results,expires_at) VALUES($1,$2::jsonb,CURRENT_TIMESTAMP+INTERVAL '7 days')
                ON CONFLICT(query) DO UPDATE SET results=EXCLUDED.results,checked_at=CURRENT_TIMESTAMP,expires_at=EXCLUDED.expires_at`,[key,JSON.stringify(results)]);
            return results;
        });
        queue=request.catch(()=>{});
        inFlight.set(key,request);
        try { return await request; } finally {inFlight.delete(key);}
    }
    async function resolve(input, options) {
        const query = [input.address || input.name,input.city].filter(Boolean).join(', ');
        const places = await search(query,options);
        const eligible=places.filter(place=>matches(place,input));
        if (eligible.length!==1) return null;
        const place=eligible[0];
        return {name:input.name || place.name,address:input.address || place.address,city:input.city || place.city,
            state:input.state || place.state || null,latitude:place.latitude,longitude:place.longitude};
    }
    async function venue(input, options) {
        if (input?.businessId) return input;
        const proposed=input?.proposal;
        if (!proposed || !proposed.name) throw new ReviewError(400,'VENUE_REQUIRED','Enter a venue name.');
        if (proposed.latitude != null && proposed.longitude != null) return input;
        if (!proposed.address && proposed.city && proposed.state) return input;
        const match=await resolve(proposed,options);
        if (!match && proposed.city && proposed.state) return input;
        if (!match) throw new ReviewError(400,'VENUE_AMBIGUOUS','Select a venue search result or use manual coordinates to confirm this location.');
        return {proposal:{...proposed,...match}};
    }
    return {search,resolve,venue};
}
module.exports={createVenueLookup,parsePlaces,matches};
