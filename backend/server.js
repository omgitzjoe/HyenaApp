require("dotenv").config();

const express = require("express");
const healthRoutes = require("./routes/health");
const experienceRoutes = require("./routes/experiences");

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/v1/experiences", experienceRoutes);

app.listen(port, () => {
    console.log(`Hyena API running at http://localhost:${port}`);
});