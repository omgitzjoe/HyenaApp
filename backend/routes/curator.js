const express = require("express");
const { randomUUID } = require("node:crypto");
const pool = require("../db");
const {
    createExperienceSchema,
    updateExperienceSchema
} = require("../validation/experience");
const requireCurator = require("../middleware/requireCurator");

const router = express.Router();

router.use(requireCurator);

router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        access: "curator"
    });
});
router.post("/experiences", async (req, res) => {
    const validation = createExperienceSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({
            error: {
                code: "INVALID_EXPERIENCE",
                message: "Check the experience fields.",
                details: validation.error.issues.map(issue => ({
                    field: issue.path.join(".") || "body",
                    message: issue.message
                }))
            }
        });
    }

    const data = validation.data;
    const experienceId = randomUUID();
    const scheduleId = randomUUID();

    let client;
    let transactionStarted = false;
    let releaseError;

    try {
        client = await pool.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const business = await client.query(`
            SELECT b.id
            FROM businesses b
            JOIN discovery_areas a ON a.id = b.area_id
            WHERE b.id = $1
                AND b.is_active = TRUE
                AND a.is_active = TRUE
            FOR SHARE OF b, a
        `, [data.businessId]);

        if (business.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                error: {
                    code: "INVALID_BUSINESS",
                    message: "Choose an existing active business in an active area."
                }
            });
        }

        const categories = await client.query(`
            SELECT id
            FROM categories
            WHERE id = ANY($1::uuid[])
            FOR KEY SHARE
        `, [data.categoryIds]);

        if (categories.rows.length !== data.categoryIds.length) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                error: {
                    code: "INVALID_CATEGORIES",
                    message: "One or more categories do not exist."
                }
            });
        }

        await client.query(`
            INSERT INTO experiences (
                id, business_id, title, description, type,
                price_amount, currency, price_label, requirements,
                image_url, source_url, is_active
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, TRUE
            )
        `, [
            experienceId,
            data.businessId,
            data.title,
            data.description,
            data.type,
            data.priceAmount,
            data.currency,
            data.offer,
            data.requirements,
            data.imageUrl,
            data.sourceUrl
        ]);

        await client.query(`
            INSERT INTO experience_categories (
                experience_id, category_id
            )
            SELECT $1::uuid, unnest($2::uuid[])
        `, [experienceId, data.categoryIds]);

        const schedule = data.schedule;

        await client.query(`
            INSERT INTO experience_schedules (
                id, experience_id, kind, start_date, end_date,
                start_time, end_time, ends_next_day, time_zone
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9
            )
        `, [
            scheduleId,
            experienceId,
            schedule.kind,
            schedule.startDate,
            schedule.endDate,
            schedule.startTime,
            schedule.endTime,
            schedule.endsNextDay,
            schedule.timeZone
        ]);

        if (schedule.weekdays.length > 0) {
            await client.query(`
                INSERT INTO experience_schedule_days (
                    schedule_id, iso_weekday
                )
                SELECT $1::uuid, unnest($2::smallint[])
            `, [scheduleId, schedule.weekdays]);
        }

        await client.query("COMMIT");
        transactionStarted = false;

        res.location(`/api/v1/experiences/${experienceId}`)
            .status(201)
            .json({
                item: {
                    id: experienceId,
                    title: data.title
                }
            });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                releaseError = rollbackError;
                console.error("Rollback failed:", rollbackError.message);
            }
        }

        console.error("Failed to create experience:", error.message);

        res.status(500).json({
            error: {
                code: "EXPERIENCE_CREATE_FAILED",
                message: "Unable to create experience."
            }
        });
    } finally {
        if (client) {
            client.release(releaseError);
        }
    }
});
router.patch("/experiences/:id/deactivate", async (req, res) => {
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
            UPDATE experiences
            SET is_active = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::uuid
            RETURNING id, title, is_active AS "isActive"
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
        console.error("Failed to deactivate experience:", error.message);

        res.status(500).json({
            error: {
                code: "EXPERIENCE_DEACTIVATE_FAILED",
                message: "Unable to deactivate experience."
            }
        });
    }
});
router.patch("/experiences/:id", async (req, res) => {
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

    const validation = updateExperienceSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({
            error: {
                code: "INVALID_EXPERIENCE_UPDATE",
                message: "Check the update fields.",
                details: validation.error.issues.map(issue => ({
                    field: issue.path.join(".") || "body",
                    message: issue.message
                }))
            }
        });
    }

    const allowedColumns = {
        title: "title",
        description: "description",
        offer: "price_label",
        requirements: "requirements"
    };

    const values = [];
    const assignments = [];

    for (const [field, value] of Object.entries(validation.data)) {
        if (value !== undefined) {
            values.push(value);
            assignments.push(
                `${allowedColumns[field]} = $${values.length}`
            );
        }
    }

    values.push(id);

    try {
        const result = await pool.query(`
            UPDATE experiences
            SET ${assignments.join(", ")},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $${values.length}::uuid
            RETURNING
                id,
                title,
                description,
                price_label AS "offer",
                requirements,
                is_active AS "isActive",
                updated_at AS "updatedAt"
        `, values);

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
        console.error("Failed to update experience:", error.message);

        res.status(500).json({
            error: {
                code: "EXPERIENCE_UPDATE_FAILED",
                message: "Unable to update experience."
            }
        });
    }
});
module.exports = router;