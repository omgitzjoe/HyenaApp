const express = require("express");

function createCategoryRouter({ pool, logger = console }) {
    const router = express.Router();
    router.get("/", async (req, res) => {
        try {
            // Discovery only needs these core fields; optional icon metadata is not required.
            const result = await pool.query(`SELECT id, name, slug, to_jsonb(c)->>'icon_key' AS "iconKey" FROM categories c ORDER BY name, id`);
            res.json({ items: result.rows, count: result.rows.length });
        } catch (error) {
            logger.error("Failed to retrieve categories:", error.message);
            res.status(500).json({ error: {
                code: "CATEGORIES_FETCH_FAILED", message: "Unable to retrieve categories."
            } });
        }
    });
    return router;
}

module.exports = createCategoryRouter;
