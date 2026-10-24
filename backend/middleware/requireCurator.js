const { timingSafeEqual } = require("node:crypto");

const configuredKey = process.env.CURATOR_API_KEY;

if (!configuredKey || !/^[a-f0-9]{64}$/i.test(configuredKey)) {
    throw new Error(
        "CURATOR_API_KEY must contain 64 hexadecimal characters."
    );
}

const expectedKey = Buffer.from(configuredKey, "hex");

function requireCurator(req, res, next) {
    const authorization = req.get("Authorization") || "";
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);

    if (match) {
        const suppliedKey = Buffer.from(match[1], "hex");

        if (timingSafeEqual(suppliedKey, expectedKey)) {
            return next();
        }
    }

    return res.status(401).json({
        error: {
            code: "CURATOR_AUTH_REQUIRED",
            message: "Valid curator credentials are required."
        }
    });
}

module.exports = requireCurator;