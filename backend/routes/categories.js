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
                icon_key AS "iconKey"
            FROM categories
            ORDER BY name, id
        `);

        res.json({
            items: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error("Failed to retrieve categories:", error.message);

        res.status(500).json({
            error: {
                code: "CATEGORIES_FETCH_FAILED",
                message: "Unable to retrieve categories."
            }
        });
    }
});

module.exports = router;