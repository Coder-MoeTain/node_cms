jest.setTimeout(30000);

const { models, sequelize } = require('../server');const loginBruteForce = require('../utils/loginBruteForce');

/** Reset shared admin account state polluted by auth/lockout/2FA tests. */
async function resetAdminUser() {
  await models.User.update(
    {
      failed_login_count: 0,
      locked_until: null,
      force_password_change: false,
      two_factor_enabled: false,
      two_factor_secret: null,
      status: 'active'
    },
    { where: { email: 'admin@example.com' } }
  );
}

async function resetLoginSecurityState() {
  await models.LoginAttempt.destroy({ where: {}, truncate: true });
  await models.BlockedIp.update({ active: false }, { where: {} });
  loginBruteForce.clearSettingsCache();
}

beforeEach(async () => {
  try {
    await sequelize.authenticate();
  } catch {
    // ignore transient pool errors; individual tests will surface real failures
  }
  await resetAdminUser();
  await resetLoginSecurityState();
});
