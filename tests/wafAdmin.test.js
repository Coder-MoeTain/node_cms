const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, models } = require('../server');
const { clearWafCache } = require('../middleware/waf');
const { login, getCsrf } = require('./helpers');
const { createZipArchive } = require('./helpers/zipFixtures');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await models.WafSetting.upsert({ setting_key: 'waf_enabled', setting_value: 'true', setting_type: 'boolean' });
  await models.WafSetting.upsert({ setting_key: 'waf_mode', setting_value: 'monitor', setting_type: 'string' });
  clearWafCache();
});

test('admin can view WAF dashboard', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/waf');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/WAF|Firewall/i);
});

test('admin can view WAF settings, rules, logs, and IP lists', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  expect((await agent.get('/admin/waf/settings')).status).toBe(200);
  expect((await agent.get('/admin/waf/rules')).status).toBe(200);
  expect((await agent.get('/admin/waf/logs')).status).toBe(200);
  expect((await agent.get('/admin/waf/ip-lists')).status).toBe(200);
});

test('admin can update WebGuard API settings in WAF UI', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/waf/settings');
  const response = await agent
    .post('/admin/waf/settings')
    .type('form')
    .send({
      _waf_settings_form: '1',
      waf_enabled: 'on',
      waf_mode: 'monitor',
      max_risk_score_public: '50',
      max_risk_score_admin: '40',
      auto_block_threshold: '5',
      auto_block_window_minutes: '10',
      auto_block_duration_minutes: '60',
      waf_response_message: 'Blocked by WAF',
      webguard_api_url: 'http://127.0.0.1:8001',
      webguard_api_key: 'ui-test-key',
      webguard_timeout_ms: '750',
      webguard_allow_localhost: 'on',
      webguard_fail_open: 'on',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const urlSetting = await models.WafSetting.findOne({ where: { setting_key: 'webguard_api_url' } });
  const keySetting = await models.WafSetting.findOne({ where: { setting_key: 'webguard_api_key' } });
  expect(urlSetting.setting_value).toBe('http://127.0.0.1:8001');
  expect(keySetting.setting_value).toBe('ui-test-key');
  clearWafCache();
});

test('admin can update WAF settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/waf/settings');
  const response = await agent
    .post('/admin/waf/settings')
    .type('form')
    .send({
      _waf_settings_form: '1',
      waf_enabled: 'on',
      waf_mode: 'monitor',
      max_risk_score_public: '50',
      max_risk_score_admin: '40',
      max_risk_score: '50',
      auto_block_threshold: '5',
      auto_block_window_minutes: '10',
      auto_block_duration_minutes: '60',
      waf_response_message: 'Blocked by WAF',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const mode = await models.WafSetting.findOne({ where: { setting_key: 'waf_mode' } });
  expect(mode.setting_value).toBe('monitor');
});

test('partial WAF settings POST does not disable protection categories', async () => {
  await models.WafSetting.upsert({ setting_key: 'block_sql_injection', setting_value: 'true', setting_type: 'boolean' });
  clearWafCache();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/waf/settings');
  await agent.post('/admin/waf/settings').type('form').send({
    waf_mode: 'monitor',
    max_risk_score_public: '50',
    _csrf: csrf
  });
  const sqlSetting = await models.WafSetting.findOne({ where: { setting_key: 'block_sql_injection' } });
  expect(sqlSetting.setting_value).toBe('true');
  clearWafCache();
});

test('admin can open WAF rule create form and toggle a custom rule', async () => {
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const rule = await models.WafRule.create({
    name: 'Toggle Test Rule',
    rule_key: `toggle_test_${Date.now()}`,
    category: 'custom',
    pattern: 'evil-probe',
    pattern_type: 'contains',
    target: 'url',
    action: 'log',
    severity: 'low',
    status: true,
    score: 10,
    is_system: false,
    created_by: admin.id
  });

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const createForm = await agent.get('/admin/waf/rules/create');
  expect(createForm.status).toBe(200);

  const toggleCsrf = await getCsrf(agent, `/admin/waf/rules/${rule.id}/edit`);
  const toggle = await agent.post(`/admin/waf/rules/${rule.id}/toggle`).type('form').send({ _csrf: toggleCsrf });
  expect(toggle.status).toBe(302);
  await rule.reload();
  expect(rule.status).toBe(false);
  await rule.destroy({ force: true });
});

test('admin can block IP from WAF log list', async () => {
  const log = await models.WafLog.create({
    request_id: `test-${Date.now()}`,
    ip_address: '203.0.113.77',
    method: 'GET',
    url: '/wp-admin',
    action_taken: 'block',
    severity: 'high',
    risk_score: 80,
    category: 'cms_probe'
  });

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const listPage = await agent.get('/admin/waf/logs');
  expect(listPage.status).toBe(200);
  expect(listPage.text).toMatch(/Block IP/);

  const csrf = await getCsrf(agent, '/admin/waf/logs');
  const block = await agent
    .post(`/admin/waf/logs/${log.id}/block-ip`)
    .type('form')
    .send({ _csrf: csrf, return_to: '/admin/waf/logs' });
  expect(block.status).toBe(302);
  expect(block.headers.location).toBe('/admin/waf/logs');

  const entry = await models.WafIpList.findOne({
    where: { ip_address: '203.0.113.77', list_type: 'blacklist', status: true }
  });
  expect(entry).toBeTruthy();

  await log.destroy({ force: true });
  if (entry) await entry.destroy({ force: true });
  clearWafCache();
});

test('admin can upload and activate a WebGuard ML model zip', async () => {
  const storageRoot = path.join(os.tmpdir(), `wg-admin-${Date.now()}`);
  fs.mkdirSync(storageRoot, { recursive: true });
  process.env.WEBGUARD_MODELS_STORAGE = storageRoot;

  const zipPath = path.join(storageRoot, 'upload.zip');
  createZipArchive({ 'rf_admin.joblib': 'model', 'preprocessor.joblib': 'prep' }, zipPath);

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/waf/settings');
  const upload = await agent
    .post(`/admin/waf/models/upload?_csrf=${encodeURIComponent(csrf)}`)
    .field('activate_after', 'on')
    .attach('model_archive', zipPath);
  expect(upload.status).toBe(302);

  const settings = await models.WafSetting.findOne({ where: { setting_key: 'ml_waf_model_id' } });
  expect(settings.setting_value).toBe('rf_admin');

  const page = await agent.get('/admin/waf/settings');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/rf_admin/);

  if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  delete process.env.WEBGUARD_MODELS_STORAGE;
  clearWafCache();
});
