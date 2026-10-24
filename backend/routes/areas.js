const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name,
                slug,
                postal_codes AS "postalCodes",
                time_zone AS "timeZone",
                latitude,
                longitude
            FROM discovery_areas
            WHERE is_active = TRUE
            ORDER BY name, id
        `);

        res.json({
            items: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error("Failed to retrieve areas:", error.message);

        res.status(500).json({
            error: {
                code: "AREAS_FETCH_FAILED",
                message: "Unable to retrieve areas."
            }
        });
    }
});

module.exports = router;