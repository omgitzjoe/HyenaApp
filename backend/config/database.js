const fs = require('node:fs');
const path = require('node:path');

function databaseConfig(env, baseDir) {
    for (const setting of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
        if (!env[setting]) throw new Error(`Missing required setting: ${setting}`);
    }
    const port = Number(env.DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid port.');
    let ca;
    if (env.DB_SSL_CA) {
        ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
    } else if (env.DB_SSL_CA_PATH) {
        ca = fs.readFileSync(path.resolve(baseDir, env.DB_SSL_CA_PATH), 'utf8');
    } else {
        throw new Error('Set DB_SSL_CA (certificate contents) or DB_SSL_CA_PATH (certificate file).');
    }
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
        throw new Error('The database CA must be a PEM certificate.');
    }
    return {
        host: env.DB_HOST, port, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
        ssl: { rejectUnauthorized: true, ca }, max: 5,
        connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000
    };
}
module.exports = { databaseConfig };
