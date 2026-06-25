const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('../models');

async function syncDatabase() {
  await sequelize.authenticate();
  // Schema changes are applied via migrations; avoid alter:true (can exceed MySQL index limits).
  await sequelize.sync();
  const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
  await sessionStore.sync();
  console.log('Database tables synced.');
  await sequelize.close();
}

syncDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
