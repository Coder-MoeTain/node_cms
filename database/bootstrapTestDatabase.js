const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
require('dotenv').config();

const migrationsDir = path.join(__dirname, 'migrations');

async function bootstrapTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('bootstrapTestDatabase is only for NODE_ENV=test');
  }

  const database = process.env.TEST_DB_NAME || 'nodepress_cms_test';
  const username = process.env.TEST_DB_USER || process.env.DB_USER || 'root';
  const password = process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '';
  const host = process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306);

  const bootstrap = new Sequelize({
    dialect: 'mysql',
    host,
    port,
    username,
    password,
    logging: false
  });

  await bootstrap.authenticate();
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await bootstrap.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrap.close();

  const { sequelize } = require('../models');
  await sequelize.authenticate();
  await sequelize.sync();

  const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
  await sessionStore.sync();

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    await sequelize.query('INSERT IGNORE INTO migrations (name) VALUES (?)', { replacements: [file] });
  }

  console.log(`Test database bootstrapped: ${database}`);
  await sequelize.close();
}

if (require.main === module) {
  bootstrapTestDatabase().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { bootstrapTestDatabase };
