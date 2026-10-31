require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const express = require("express");
const healthRoutes = require("./routes/health");
const createExperienceRouter = require("./routes/experiences");
const pool = require("./db");
const createCategoryRouter = require("./routes/categories");
const createSubmissionRouter = require("./routes/submissions");
const createBusinessRouter = require("./routes/businesses");
const { createAdminRouter } = require("./routes/admin");
const curatorRoutes = require("./routes/curator");

const app = express();
const port = Number(process.env.PORT || 4010);

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(express.json({ limit: "64kb" }));
app.get("/", (req, res) => res.json({
    service: "hyena-api", status: "ok", health: "/health", databaseHealth: "/health/db",
    experiences: "/api/v1/experiences", categories: "/api/v1/categories"
}));

app.use("/health", healthRoutes);
app.use("/api/v1/experiences", createExperienceRouter({ pool }));
app.use("/api/v1/categories", createCategoryRouter({ pool }));
app.get("/api/v1/areas", (req, res) => res.status(410).json({ error: { code: "AREAS_REMOVED", message: "Use location coordinates for discovery." } }));
app.use("/api/v1/curator", curatorRoutes);
app.use("/api/v1/businesses", createBusinessRouter({ pool }));
app.use("/api/v1/submissions", createSubmissionRouter({ pool }));
app.use("/api/v1/reports", require("./routes/reports").createReportRouter({ pool }));
app.use("/admin", createAdminRouter({ pool }));
app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: { code: "BODY_TOO_LARGE", message: "The request is too large." } });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: { code: "INVALID_JSON", message: "Send valid JSON." } });
    console.error("Request failed:", error.message);
    res.status(500).json({ error: { code: "REQUEST_FAILED", message: "Unable to complete the request." } });
});

const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Hyena API running at http://localhost:${port}`);
});
process.once("SIGTERM", () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
        try { await pool.end(); clearTimeout(timeout); process.exit(0); }
        catch { process.exit(1); }
    });
});
