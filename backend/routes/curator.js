const express = require("express");
const { publishExperience, ReviewError } = require("../services/publishExperience");
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

    let client;
    let started = false;
    let releaseError;
    try {
        client = await pool.connect();
        await client.query("BEGIN"); started = true;
        const item = await publishExperience(client, validation.data);
        await client.query("COMMIT"); started = false;
        res.location(`/api/v1/experiences/${item.id}`).status(201).json({ item });
    } catch (error) {
        if (client && started) {
            try { await client.query("ROLLBACK"); } catch (rollbackError) { releaseError = rollbackError; }
        }
        if (error instanceof ReviewError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
        console.error("Failed to create experience:", error.message);
        res.status(500).json({ error: { code: "EXPERIENCE_CREATE_FAILED", message: "Unable to create experience." } });
    } finally { if (client) client.release(releaseError); }
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