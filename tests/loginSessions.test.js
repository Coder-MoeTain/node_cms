const request = require('supertest');
const sequelize = require('../config/database');
const { app, models } = require('../server');
const { login, getCsrf, postForm } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can view login sessions page under settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/settings/login-sessions');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Login &amp; Sessions|Login & Sessions/i);
  expect(response.text).toMatch(/Active Admin Sessions/i);
  expect(response.text).toMatch(/Login Activity/i);
  expect(response.text).toMatch(/Revoke/i);
});

test('login sessions page lists recent login attempts', async () => {
  await models.LoginAttempt.create({
    email: 'admin@example.com',
    ip_address: '203.0.113.77',
    user_agent: 'jest-test',
    success: true,
    reason: 'success'
  });
  await models.LoginAttempt.create({
    email: 'wrong@example.com',
    ip_address: '203.0.113.88',
    user_agent: 'jest-test',
    success: false,
    reason: 'invalid_credentials'
  });

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/settings/login-sessions');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/203\.0\.113\.77/);
  expect(response.text).toMatch(/203\.0\.113\.88/);
  expect(response.text).toMatch(/Success/i);
  expect(response.text).toMatch(/Failed/i);
});

test('guest cannot access login sessions page', async () => {
  const response = await request(app).get('/admin/settings/login-sessions');
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/login/);
});

test('admin can revoke another active session', async () => {
  const agent1 = request.agent(app);
  const agent2 = request.agent(app);

  const [beforeRows] = await sequelize.query(
    'SELECT sid FROM sessions WHERE expires > UTC_TIMESTAMP()'
  );
  const beforeIds = new Set(beforeRows.map((row) => row.sid));

  await login(agent2, 'admin@example.com', 'Admin@12345');

  const [afterAgent2] = await sequelize.query(
    'SELECT sid FROM sessions WHERE expires > UTC_TIMESTAMP()'
  );
  const agent2Sid = afterAgent2.find((row) => !beforeIds.has(row.sid))?.sid;
  expect(agent2Sid).toBeTruthy();

  await login(agent1, 'admin@example.com', 'Admin@12345');

  const revokeResponse = await postForm(
    agent1,
    '/admin/settings/login-sessions/revoke',
    { session_id: agent2Sid },
    '/admin/settings/login-sessions'
  );
  expect(revokeResponse.status).toBe(302);
  expect(revokeResponse.headers.location).toMatch(/login-sessions/);

  const [remaining] = await sequelize.query(
    'SELECT sid FROM sessions WHERE sid = ?',
    { replacements: [agent2Sid] }
  );
  expect(remaining.length).toBe(0);

  const blocked = await agent2.get('/admin');
  expect(blocked.status).toBe(302);
  expect(blocked.headers.location).toMatch(/login/);

  const stillIn = await agent1.get('/admin/settings/login-sessions');
  expect(stillIn.status).toBe(200);
});

test('login records remote IP from X-Forwarded-For when trusted proxy is enabled', async () => {
  await models.WafSetting.update(
    { setting_value: 'true' },
    { where: { setting_key: 'trusted_proxy_enabled' } }
  );

  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const response = await agent
    .post('/admin/login')
    .set('X-Forwarded-For', '198.51.100.42')
    .type('form')
    .send({ email: 'admin@example.com', password: 'Admin@12345', _csrf: csrf });

  expect(response.status).toBe(302);
  expect(response.headers.location).not.toMatch(/login/);

  const attempt = await models.LoginAttempt.findOne({
    where: { email: 'admin@example.com', ip_address: '198.51.100.42' },
    order: [['id', 'DESC']]
  });
  expect(attempt).toBeTruthy();

  const page = await agent.get('/admin/settings/login-sessions');
  expect(page.text).toMatch(/198\.51\.100\.42/);

  await models.WafSetting.update(
    { setting_value: 'false' },
    { where: { setting_key: 'trusted_proxy_enabled' } }
  );
});
