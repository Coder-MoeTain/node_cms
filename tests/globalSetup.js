module.exports = async () => {
  const { execSync } = require('child_process');
  const { sequelize, models } = require('../server');
  execSync('node database/migrate.js', { stdio: 'inherit', env: process.env });
  await sequelize.authenticate();
  await models.User.update(
    { force_password_change: false },
    { where: { email: 'admin@example.com' } }
  );
};
