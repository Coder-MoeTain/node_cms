const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('forgot password form is accessible', async () => {
  const response = await request(app).get('/admin/forgot-password');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/forgot|reset/i);
});

test('forgot password generates reset token in development', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/admin/forgot-password');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent
    .post('/admin/forgot-password')
    .type('form')
    .send({ email: 'admin@example.com', _csrf: csrf });
  expect(response.status).toBe(302);
  const tokenCount = await models.PasswordResetToken.count();
  expect(tokenCount).toBeGreaterThan(0);
});

test('profile page loads for authenticated admin', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/profile');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Profile/i);
});

test('admin can update profile name', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/profile');
  const response = await agent
    .put('/admin/profile')
    .type('form')
    .send({ name: 'Super Admin', email: 'admin@example.com', _csrf: csrf });
  expect(response.status).toBe(302);
});

test('reset password form accepts token query param', async () => {
  const response = await request(app).get('/admin/reset-password?token=sample-token');
  expect(response.status).toBe(200);
});

test('account lockout blocks login after repeated failures', async () => {
  const agent = request.agent(app);
  for (let i = 0; i < 5; i++) {
    const page = await agent.get('/admin/login');
    const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
    await agent.post('/admin/login').type('form').send({
      email: 'admin@example.com',
      password: 'wrong-password-lockout',
      _csrf: csrf
    });
  }
  const user = await models.User.findOne({ where: { email: 'admin@example.com' } });
  expect(user.failed_login_count).toBeGreaterThanOrEqual(5);
  expect(user.locked_until).toBeTruthy();
  await user.update({ failed_login_count: 0, locked_until: null });
});
