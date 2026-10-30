const lookup = require('@photostructure/tz-lookup');
function venueTimeZone(location) {
    if (!location || location.latitude == null || location.longitude == null ||
        !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude)) ||
        Math.abs(Number(location.latitude)) > 90 || Math.abs(Number(location.longitude)) > 180) {
        const { ReviewError } = require('./publishExperience');
        throw new ReviewError(400, 'VENUE_LOCATION_REQUIRED', 'The venue needs valid latitude and longitude before publishing.');
    }
    return lookup(Number(location.latitude), Number(location.longitude));
}
function distanceMiles(a, b) {
    const rad = x => Number(x) * Math.PI / 180;
    const h = Math.sin((rad(b.latitude) - rad(a.latitude))/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin((rad(b.longitude)-rad(a.longitude))/2)**2;
    return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0,h))));
}
module.exports = { venueTimeZone, distanceMiles };
