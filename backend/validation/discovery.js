const { Temporal } = require("@js-temporal/polyfill");

class DiscoveryQueryError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function parseDiscoveryQuery(query) {
    const search = query.q ?? "";
    if (typeof search !== "string" || search.length > 100) {
        throw new DiscoveryQueryError("INVALID_SEARCH", "Search must be text with at most 100 characters.");
    }
    const window = query.window ?? "today";
    if (typeof window !== "string" || !["today", "tonight", "now", "date", "all"].includes(window)) {
        throw new DiscoveryQueryError("INVALID_WINDOW", "Choose today, tonight, now, date, or all.");
    }
    let date = null;
    if (window === "date") {
        try {
            if (typeof query.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
                throw new RangeError();
            }
            date = Temporal.PlainDate.from(query.date).toString();
        } catch {
            throw new DiscoveryQueryError("INVALID_DATE", "Provide a valid date in YYYY-MM-DD format.");
        }
    } else if (query.date !== undefined) {
        throw new DiscoveryQueryError("INVALID_DATE", "The date parameter requires window=date.");
    }
    const rawLimit = query.limit ?? "20";
    if (typeof rawLimit !== "string" || !/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100) {
        throw new DiscoveryQueryError("INVALID_LIMIT", "Limit must be an integer from 1 through 100.");
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const key of ["areaId", "categoryId"]) {
        if (query[key] !== undefined && (typeof query[key] !== "string" || !uuid.test(query[key]))) {
            throw new DiscoveryQueryError(key === "areaId" ? "INVALID_AREA" : "INVALID_CATEGORY", `${key} must be a UUID.`);
        }
    }
    // Cursor pagination is not implemented: never silently repeat page one.
    if (query.cursor !== undefined) {
        throw new DiscoveryQueryError("UNSUPPORTED_CURSOR", "Cursor pagination is not available yet.");
    }
    let timeZone = null;
    if (query.timeZone !== undefined) {
        try {
            if (typeof query.timeZone !== "string" || query.timeZone.length > 100 || /^[+-]/.test(query.timeZone)) throw new RangeError();
            Temporal.Instant.from("2026-01-01T00:00Z").toZonedDateTimeISO(query.timeZone);
            timeZone = query.timeZone;
        } catch { throw new DiscoveryQueryError("INVALID_TIME_ZONE", "Provide a valid IANA time zone."); }
    }
    let proximity = null;
    if ([query.latitude, query.longitude, query.radiusMiles].some(v => v !== undefined)) {
        const number = (value, min, max) => typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
        if (!number(query.latitude, -90, 90) || !number(query.longitude, -180, 180) || !number(query.radiusMiles ?? "10", 1, 100)) {
            throw new DiscoveryQueryError("INVALID_PROXIMITY", "Provide latitude, longitude, and a radius from 1 to 100 miles.");
        }
        if (query.areaId !== undefined) throw new DiscoveryQueryError("INVALID_PROXIMITY", "Choose proximity or area filtering, not both.");
        proximity = { latitude: Number(query.latitude), longitude: Number(query.longitude), radiusMiles: Number(query.radiusMiles ?? 10) };
    }
    return {
        search: search.trim(), window, date, timeZone, proximity, limit: Number(rawLimit),
        areaId: query.areaId ?? null, categoryId: query.categoryId ?? null
    };
}

module.exports = { parseDiscoveryQuery, DiscoveryQueryError };
