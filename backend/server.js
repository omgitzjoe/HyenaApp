require("dotenv").config();

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

app.use("/health", healthRoutes);
app.use("/api/v1/experiences", createExperienceRouter({ pool }));
app.use("/api/v1/categories", createCategoryRouter({ pool }));
app.use("/api/v1/areas", areaRoutes);
app.use("/api/v1/curator", curatorRoutes);

app.listen(port, () => {
    console.log(`Hyena API running at http://localhost:${port}`);
});