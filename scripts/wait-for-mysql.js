const { Sequelize } = require('sequelize');
const { authenticateWithRetry } = require('../utils/testDatabase');

async function main() {
  const host = process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306);
  const username = process.env.TEST_DB_USER || process.env.DB_USER || 'root';
  const password = process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '';

  const sequelize = new Sequelize({
    dialect: 'mysql',
    host,
    port,
    username,
    password,
    logging: false
  });

  try {
    await authenticateWithRetry(sequelize, 'CI MySQL service', 30, 2000);
    console.log('MySQL is ready.');
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
