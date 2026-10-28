const express = require("express");
const { discoverExperiences } = require("../services/discovery");
const { DiscoveryQueryError } = require("../validation/discovery");

function createExperienceRouter({ pool, clock = () => new Date(), logger = console }) {
    const router = express.Router();

    router.get("/", async (req, res) => {
        try {
            res.json(await discoverExperiences(pool, req.query, clock(), logger));
        } catch (error) {
            if (error instanceof DiscoveryQueryError) {
                return res.status(400).json({ error: { code: error.code, message: error.message } });
            }
            logger.error("Failed to retrieve experiences:", error.message);
            res.status(500).json({ error: {
                code: "EXPERIENCES_FETCH_FAILED", message: "Unable to retrieve experiences."
            } });
        }
    });

    router.get("/:id", async (req, res) => {
        const { id } = req.params;
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(id)) {
            return res.status(400).json({
                error: {
                    code: "INVALID_EXPERIENCE_ID",
                    message: "Experience ID must be a valid UUID."
                }
            });
        }

        try {
            const result = await pool.query(`
                SELECT
                    e.id,
                    e.title,
                    e.description,
                    e.type,
                    e.price_amount AS "priceAmount",
                    e.currency,
                    e.price_label AS "offer",
                    e.requirements,
                    e.image_url AS "imageUrl",
                    e.source_url AS "sourceUrl",
                    b.id AS "businessId",
                    b.name AS "businessName",
                    b.address,
                    b.city,
                    b.region,
                    b.postal_code AS "postalCode",
                    b.latitude,
                    b.longitude,
                    b.phone,
                    b.website_url AS "websiteUrl",
                    a.id AS "areaId",
                    a.name AS "areaName",
                    s.kind AS "scheduleKind",
                    s.start_date::text AS "startDate",
                    s.end_date::text AS "endDate",
                    s.start_time AS "startTime",
                    s.end_time AS "endTime",
                    s.ends_next_day AS "endsNextDay",
                    s.time_zone AS "timeZone",
                    ARRAY(
                        SELECT sd.iso_weekday
                        FROM experience_schedule_days sd
                        WHERE sd.schedule_id = s.id
                        ORDER BY sd.iso_weekday
                    ) AS "weekdays",
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'id', c.id,
                                    'name', c.name,
                                    'slug', c.slug
                                )
                                ORDER BY c.name, c.id
                            )
                            FROM experience_categories ec
                            JOIN categories c ON c.id = ec.category_id
                            WHERE ec.experience_id = e.id
                        ),
                        '[]'::json
                    ) AS "categories"
                FROM experiences e
                JOIN businesses b ON b.id = e.business_id
                JOIN discovery_areas a ON a.id = b.area_id
                JOIN experience_schedules s ON s.experience_id = e.id
                WHERE e.id = $1::uuid
                    AND e.is_active = TRUE
                    AND b.is_active = TRUE
                    AND a.is_active = TRUE
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: {
                        code: "EXPERIENCE_NOT_FOUND",
                        message: "Experience not found."
                    }
                });
            }

            res.json({
                item: result.rows[0]
            });
        } catch (error) {
            console.error("Failed to retrieve experience:", error.message);

            res.status(500).json({
                error: {
                    code: "EXPERIENCE_FETCH_FAILED",
                    message: "Unable to retrieve experience."
                }
            });
        }
    });
    return router;
}

module.exports = createExperienceRouter;
