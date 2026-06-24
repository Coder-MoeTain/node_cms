const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('../models');

async function syncDatabase() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
  await sessionStore.sync();
  console.log('Database tables synced.');
  await sequelize.close();
}

syncDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
