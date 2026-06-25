const fs = require('fs');
const path = require('path');

const runtimeFile = path.join(__dirname, '.test-runtime.json');

module.exports = async () => {
  const { execSync } = require('child_process');

  if (process.env.NODE_ENV === 'test') {
    process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || `nodepress_cms_test_${process.pid}`;
    process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1';
    process.env.TEST_DB_USER = process.env.TEST_DB_USER || process.env.DB_USER || 'root';
    if (process.env.TEST_DB_PASSWORD === undefined) {
      process.env.TEST_DB_PASSWORD = process.env.DB_PASSWORD || '';
    }
    process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT || '3306';
    fs.writeFileSync(runtimeFile, JSON.stringify({ TEST_DB_NAME: process.env.TEST_DB_NAME }));
  }

  const env = { ...process.env };
  execSync('node database/bootstrapTestDatabase.js', { stdio: 'inherit', env });
  execSync('node database/seed.js', { stdio: 'inherit', env });

  const { sequelize, models } = require('../server');
  await sequelize.authenticate();
  await models.User.update(
    { force_password_change: false },
    { where: { email: 'admin@example.com' } }
  );
};
