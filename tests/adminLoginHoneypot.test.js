const request = require('supertest');
const { app, models } = require('../server');
const adminLoginPath = require('../utils/adminLoginPath');
const { getCsrf, login } = require('./helpers');

const HONEYPOT_IP = '203.0.113.199';
const SECRET_SLUG = 'np-auth-honeypottest';

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

beforeEach(async () => {
  await models.BlockedIp.update({ active: false }, { where: {} });
  await models.SecuritySetting.upsert({
    key: 'admin_login_honeypot_enabled',
    value: 'true',
    enabled: true
  });
  await models.SecuritySetting.upsert({
    key: 'admin_login_secret_slug',
    value: SECRET_SLUG,
    enabled: true
  });
  adminLoginPath.clearConfigCache();
});

afterAll(async () => {
  await models.SecuritySetting.upsert({
    key: 'admin_login_honeypot_enabled',
    value: 'false',
    enabled: false
  });
  adminLoginPath.clearConfigCache();
});

test('honeypot login page is shown at /admin/login when enabled', async () => {
  const response = await request(app).get('/admin/login');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Log In/i);
  expect(response.text).toMatch(/action="\/admin\/login"/);
});

test('honeypot login attempt blocks attacker IP automatically', async () => {
  await models.WafSetting.update(
    { setting_value: 'true' },
    { where: { setting_key: 'trusted_proxy_enabled' } }
  );
  const { invalidateTrustedProxyCache } = require('../utils/loginSessionHelper');
  invalidateTrustedProxyCache();

  await models.BlockedIp.update({ active: false }, { where: { ip_address: HONEYPOT_IP } });

  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const response = await agent
    .post('/admin/login')
    .set('X-Forwarded-For', HONEYPOT_IP)
    .type('form')
    .send({ email: 'attacker@evil.com', password: 'wrong-password', _csrf: csrf });

  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/\/admin\/login/);

  const blocked = await models.BlockedIp.findOne({ where: { ip_address: HONEYPOT_IP, active: true } });
  expect(blocked).toBeTruthy();
  expect(blocked.reason).toMatch(/honeypot/i);

  const attempt = await models.LoginAttempt.findOne({
    where: { ip_address: HONEYPOT_IP, reason: 'honeypot_trap' },
    order: [['id', 'DESC']]
  });
  expect(attempt).toBeTruthy();

  const denied = await request(app)
    .get('/admin/login')
    .set('X-Forwarded-For', HONEYPOT_IP);
  expect(denied.status).toBe(403);

  await models.BlockedIp.update({ active: false }, { where: { ip_address: HONEYPOT_IP } });
  await models.WafSetting.update(
    { setting_value: 'false' },
    { where: { setting_key: 'trusted_proxy_enabled' } }
  );
  invalidateTrustedProxyCache();
});

test('valid credentials cannot log in through honeypot URL', async () => {
  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const response = await agent
    .post('/admin/login')
    .type('form')
    .send({ email: 'admin@example.com', password: 'Admin@12345', _csrf: csrf });

  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/\/admin\/login/);
  expect(response.headers.location).not.toBe('/admin');

  const dashboard = await agent.get('/admin');
  expect(dashboard.status).not.toBe(200);
});

test('main security settings save does not disable honeypot', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await (async () => {
    const page = await agent.get('/admin/security');
    const match = page.text.match(/name="_csrf" value="([^"]+)"/);
    return match?.[1] || '';
  })();

  await agent
    .put('/admin/security/settings?_method=PUT')
    .type('form')
    .send({ login_attempt_limiter: 'on', _csrf: csrf });

  adminLoginPath.clearConfigCache();
  const config = await adminLoginPath.getConfig({ fresh: true });
  expect(config.honeypotEnabled).toBe(true);
});

test('real admin login works on secret path when honeypot is enabled', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const dashboard = await agent.get('/admin');
  expect(dashboard.status).toBe(200);
});

test('secret login path rejects unknown slug', async () => {
  const response = await request(app).get('/admin/np-auth-wrongslug123');
  expect(response.status).toBe(404);
});
