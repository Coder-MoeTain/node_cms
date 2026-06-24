const { Sequelize } = require('sequelize');
require('dotenv').config();

async function ensureDatabase() {
  const isTest = process.env.NODE_ENV === 'test';
  const database = (isTest && process.env.TEST_DB_NAME) || process.env.DB_NAME || 'nodepress_cms';
  const username = (isTest && process.env.TEST_DB_USER) || process.env.DB_USER || 'root';
  const password = (isTest && process.env.TEST_DB_PASSWORD) || process.env.DB_PASSWORD || '';
  const host = (isTest && process.env.TEST_DB_HOST) || process.env.DB_HOST || '127.0.0.1';
  const port = Number((isTest && process.env.TEST_DB_PORT) || process.env.DB_PORT || 3306);

  const bootstrap = new Sequelize({
    dialect: 'mysql',
    host,
    port,
    username,
    password,
    logging: false
  });

  try {
    await bootstrap.authenticate();
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ready: ${database}`);
  } finally {
    await bootstrap.close();
  }
}

if (require.main === module) {
  ensureDatabase().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { ensureDatabase };
