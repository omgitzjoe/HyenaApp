require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const express = require("express");
const healthRoutes = require("./routes/health");
const createExperienceRouter = require("./routes/experiences");
const pool = require("./db");
const createCategoryRouter = require("./routes/categories");
const areaRoutes = require("./routes/areas");
const curatorRoutes = require("./routes/curator");

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(express.json());
app.get("/", (req, res) => res.json({
    service: "hyena-api", status: "ok", health: "/health", databaseHealth: "/health/db",
    experiences: "/api/v1/experiences", categories: "/api/v1/categories"
}));

app.use("/health", healthRoutes);
app.use("/api/v1/experiences", createExperienceRouter({ pool }));
app.use("/api/v1/categories", createCategoryRouter({ pool }));
app.use("/api/v1/areas", areaRoutes);
app.use("/api/v1/curator", curatorRoutes);

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
