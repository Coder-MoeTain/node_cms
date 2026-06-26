const request = require('supertest');
const { app, models } = require('../server');
const { login } = require('./helpers');

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
