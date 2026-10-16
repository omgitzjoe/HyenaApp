require("dotenv").config();

const express = require("express");
const pool = require("./db");

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "hyena-api"
    });
});
app.get("/health/db", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            status: "ok",
            database: "connected"
        });
    } catch (error) {
        console.error("Database health check failed:", error.message);

        res.status(503).json({
            status: "error",
            database: "unavailable"
        });
    }
});
app.get("/api/v1/experiences", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                e.id,
                e.title,
                e.description,
                b.name AS "businessName",
                b.city,
                e.price_amount AS "priceAmount",
                e.currency,
                e.price_label AS "offer",
                s.kind AS "scheduleKind",
                s.start_date AS "startDate",
                s.end_date AS "endDate",
                s.start_time AS "startTime",
                s.end_time AS "endTime",
                s.ends_next_day AS "endsNextDay",
                s.time_zone AS "timeZone"
            FROM experiences e
            JOIN businesses b ON b.id = e.business_id
            JOIN discovery_areas a ON a.id = b.area_id
            JOIN experience_schedules s ON s.experience_id = e.id
            WHERE e.is_active = TRUE
                AND b.is_active = TRUE
                AND a.is_active = TRUE
            ORDER BY e.title, e.id
            LIMIT 20
        `);

        res.json({
            items: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error("Failed to retrieve experiences:", error.message);

        res.status(500).json({
            error: {
                code: "EXPERIENCES_FETCH_FAILED",
                message: "Unable to retrieve experiences."
            }
        });
    }
});
app.listen(port, () => {
    console.log(`Hyena API running at http://localhost:${port}`);
});