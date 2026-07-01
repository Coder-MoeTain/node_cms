const path = require('path');
const { Sequelize } = require('sequelize');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { resolveIsolatedTestDatabaseName, authenticateWithRetry } = require('../utils/testDatabase');
const { applyPendingMigrations } = require('./migrationRunner');
require('dotenv').config();

async function bootstrapTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('bootstrapTestDatabase is only for NODE_ENV=test');
  }

  const database = resolveIsolatedTestDatabaseName();
  process.env.TEST_DB_NAME = database;
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

  await authenticateWithRetry(bootstrap, 'Test bootstrap MySQL');
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await bootstrap.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrap.close();

  const { sequelize } = require('../models');
  await authenticateWithRetry(sequelize, 'Test app MySQL');

  const { ensureBaseSchema } = require('./ensureBaseSchema');
  await ensureBaseSchema(sequelize);

  const { applyPendingMigrations } = require('./migrationRunner');
  const { ensureSiteScopeColumns } = require('./ensureMultisiteSchema');
  const appliedBeforeWidgets = await applyPendingMigrations(sequelize);
  if (appliedBeforeWidgets.length) {
    console.log(`Applied ${appliedBeforeWidgets.length} test migration(s) before widget seed`);
  }
  const repaired = await ensureSiteScopeColumns(sequelize);
  if (repaired.length) {
    console.log(`Ensured multisite columns: ${repaired.join(', ')}`);
  }

  const { ensureDefaultWidgetAreas } = require('../utils/widgetRegistry');
  const models = require('../models');
  await ensureDefaultWidgetAreas(models);

  const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
  await sessionStore.sync();

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
