const { parseDiscoveryQuery, DiscoveryQueryError } = require("../validation/discovery");
const { asInstant, evaluateCandidates } = require("./recurrence");

async function discoverExperiences(pool, query, now = new Date(), logger = console) {
    const filters = parseDiscoveryQuery(query);
    // Freeze the request clock before any database I/O.
    const evaluatedAt = asInstant(now).toString();
    if (filters.areaId) {
        const area = await pool.query("SELECT id FROM discovery_areas WHERE id = $1::uuid AND is_active = TRUE", [filters.areaId]);
        if (!area.rows.length) throw new DiscoveryQueryError("INVALID_AREA", "Choose an existing active discovery area.");
    }
    if (filters.categoryId) {
        const category = await pool.query("SELECT id FROM categories WHERE id = $1::uuid", [filters.categoryId]);
        if (!category.rows.length) throw new DiscoveryQueryError("INVALID_CATEGORY", "Choose an existing category.");
    }
    const pattern = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    // Deliberately no SQL LIMIT: recurrence must be evaluated before limiting.
    // This in-memory stage is intended for the curated prototype dataset.
    const result = await pool.query(`
        SELECT e.id, e.title, e.description, b.latitude, b.longitude, b.name AS "businessName", b.city,
            e.price_amount AS "priceAmount", e.currency, e.price_label AS "offer",
            s.kind AS "scheduleKind", s.start_date::text AS "startDate",
            s.end_date::text AS "endDate", s.start_time AS "startTime",
            s.end_time AS "endTime", s.ends_next_day AS "endsNextDay", s.time_zone AS "timeZone",
            ARRAY(SELECT sd.iso_weekday FROM experience_schedule_days sd
                WHERE sd.schedule_id = s.id ORDER BY sd.iso_weekday) AS weekdays
        FROM experiences e
        JOIN businesses b ON b.id = e.business_id
        JOIN discovery_areas a ON a.id = b.area_id
        JOIN experience_schedules s ON s.experience_id = e.id
        WHERE e.is_active = TRUE AND b.is_active = TRUE AND a.is_active = TRUE
            AND ($2::uuid IS NULL OR a.id = $2::uuid)
            AND ($3::uuid IS NULL OR EXISTS (
                SELECT 1 FROM experience_categories filter_category
                WHERE filter_category.experience_id = e.id AND filter_category.category_id = $3::uuid
            ))
            AND (e.title ILIKE $1 OR e.description ILIKE $1 OR b.name ILIKE $1 OR e.price_label ILIKE $1
                OR EXISTS (SELECT 1 FROM experience_categories ec JOIN categories c ON c.id = ec.category_id
                    WHERE ec.experience_id = e.id AND c.name ILIKE $1))
    `, [pattern, filters.areaId, filters.categoryId]);
    const rows = filters.proximity ? result.rows.filter(row => {
        if (row.latitude == null || row.longitude == null) return false;
        const radians = degrees => degrees * Math.PI / 180;
        const { latitude, longitude, radiusMiles } = filters.proximity;
        const dLat = radians(Number(row.latitude) - latitude);
        const dLon = radians(Number(row.longitude) - longitude);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(Number(row.latitude))) * Math.sin(dLon / 2) ** 2;
        row.distanceMiles = 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
        return row.distanceMiles <= radiusMiles;
    }) : result.rows;
    for (const row of rows) { delete row.latitude; delete row.longitude; }
    return evaluateCandidates(rows, filters, evaluatedAt, id => logger.warn("Invalid discovery schedule:", id));
}

module.exports = { discoverExperiences };
