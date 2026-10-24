require("dotenv").config();

const express = require("express");
const healthRoutes = require("./routes/health");
const experienceRoutes = require("./routes/experiences");
const categoryRoutes = require("./routes/categories");
const areaRoutes = require("./routes/areas");
const curatorRoutes = require("./routes/curator");

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/v1/experiences", experienceRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/areas", areaRoutes);
app.use("/api/v1/curator", curatorRoutes);

app.listen(port, () => {
    console.log(`Hyena API running at http://localhost:${port}`);
});