jest.setTimeout(30000);

const { models, sequelize } = require('../server');
const loginBruteForce = require('../utils/loginBruteForce');
const adminLoginPath = require('../utils/adminLoginPath');

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
  await models.SecuritySetting.upsert({
    key: 'maintenance_mode',
    value: 'false',
    enabled: false
  });
  await models.SiteSetting.upsert({
    key: 'maintenance_mode',
    value: 'false',
    group: 'security'
  });
  await models.SecuritySetting.upsert({
    key: 'admin_login_honeypot_enabled',
    value: 'false',
    enabled: false
  });
  loginBruteForce.clearSettingsCache();
  adminLoginPath.clearConfigCache();
}

async function resetWafState() {
  const { clearWafCache } = require('../middleware/waf');
  const defaults = [
    ['waf_enabled', 'true', 'boolean'],
    ['waf_mode', 'monitor', 'string'],
    ['block_sql_injection', 'true', 'boolean'],
    ['block_xss', 'true', 'boolean'],
    ['block_path_traversal', 'true', 'boolean'],
    ['block_command_injection', 'true', 'boolean'],
    ['block_bad_bots', 'true', 'boolean'],
    ['block_scanners', 'true', 'boolean'],
    ['block_cms_probes', 'true', 'boolean'],
    ['admin_protection_enabled', 'true', 'boolean'],
    ['public_protection_enabled', 'true', 'boolean']
  ];
  for (const [setting_key, setting_value, setting_type] of defaults) {
    await models.WafSetting.upsert({ setting_key, setting_value, setting_type });
  }
  clearWafCache();
}

async function resetPublicRenderState() {
  await models.SiteTemplate.update(
    { status: 'inactive' },
    { where: { status: 'active', template_type: ['homepage', 'blog', '404'] } }
  );
  await models.SiteSetting.upsert({
    key: 'permalink_structure',
    value: '/post/%slug%',
    group: 'seo'
  });
  await models.SiteSetting.upsert({
    key: 'page_permalink_structure',
    value: '/page/%slug%',
    group: 'seo'
  });
  const { ensureStandardTheme } = require('./helpers');
  await ensureStandardTheme(models);
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

afterEach(async () => {
  await resetPublicRenderState();
});
