jest.setTimeout(30000);

const { models, sequelize } = require('../server');
const loginBruteForce = require('../utils/loginBruteForce');

/** Reset shared admin account state polluted by auth/lockout/2FA tests. */
async function resetAdminUser() {
  const superAdminRole = await models.Role.findOne({ where: { slug: 'super-admin' } });
  const payload = {
    failed_login_count: 0,
    locked_until: null,
    force_password_change: false,
    two_factor_enabled: false,
    two_factor_secret: null,
    status: 'active'
  };
  if (superAdminRole) payload.role_id = superAdminRole.id;
  await models.User.update(payload, { where: { email: 'admin@example.com' } });
}

async function resetLoginSecurityState() {
  await models.LoginAttempt.destroy({ where: {}, truncate: true });
  await models.BlockedIp.update({ active: false }, { where: {} });
  loginBruteForce.clearSettingsCache();
}

async function resetSecuritySettings() {
  await models.SecuritySetting.upsert({
    key: 'login_attempt_limiter',
    value: 'false',
    enabled: false
  });
  await models.SecuritySetting.upsert({
    key: 'login_max_ip_attempts',
    value: '10',
    enabled: true
  });
  loginBruteForce.clearSettingsCache();
}

async function resetWafState() {
  const { clearWafCache } = require('../middleware/waf');
  await models.WafSetting.upsert({
    setting_key: 'waf_enabled',
    setting_value: 'true',
    setting_type: 'boolean'
  });
  await models.WafSetting.upsert({
    setting_key: 'waf_mode',
    setting_value: 'monitor',
    setting_type: 'string'
  });
  clearWafCache();
}

beforeEach(async () => {
  try {
    await sequelize.authenticate();
  } catch {
    // ignore transient pool errors; individual tests will surface real failures
  }
  await resetAdminUser();
  await resetLoginSecurityState();
  await resetSecuritySettings();
  await resetWafState();
});
