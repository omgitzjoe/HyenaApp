const { Pool } = require('pg');
const { databaseConfig } = require('./config/database');

const pool = new Pool(databaseConfig(process.env, __dirname));
pool.on('error', error => console.error('Unexpected database connection error:', error.message));
module.exports = pool;
