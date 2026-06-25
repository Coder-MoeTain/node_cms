const request = require('supertest');
const { app, models } = require('../server');
const { clearWafCache } = require('../middleware/waf');
const { login, getCsrf } = require('./helpers');

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

test('admin can update WAF settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/waf/settings');
  const response = await agent
    .post('/admin/waf/settings')
    .type('form')
    .send({
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
