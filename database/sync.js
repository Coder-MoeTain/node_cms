const { sequelize } = require('../models');

async function syncDatabase() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('Database tables synced.');
  await sequelize.close();
}

syncDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
