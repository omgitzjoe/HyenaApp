const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const requiredSettings = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DB_SSL_CA_PATH"
];

for (const setting of requiredSettings) {
    if (!process.env[setting]) {
        throw new Error(`Missing required setting: ${setting}`);
    }
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
            path.resolve(__dirname, process.env.DB_SSL_CA_PATH),
            "utf8"
        )
    },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

pool.on("error", (error) => {
    console.error("Unexpected database connection error:", error.message);
});

module.exports = pool;