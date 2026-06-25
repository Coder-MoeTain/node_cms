const request = require('supertest');
const bcrypt = require('bcrypt');
const loginBruteForce = require('../utils/loginBruteForce');
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
  const adminRole = await models.Role.findOne({ where: { slug: 'super-admin' } });
  const lockoutEmail = `lockout-${Date.now()}@test.local`;
  await models.User.create({
    name: 'Lockout Test User',
    email: lockoutEmail,
    password: await bcrypt.hash('Lockout@12345', 12),
    role_id: adminRole.id,
    status: 'active',
    force_password_change: false
  });

  const agent = request.agent(app);
  for (let i = 0; i < 5; i++) {
    const page = await agent.get('/admin/login');
    const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
    await agent.post('/admin/login').type('form').send({
      email: lockoutEmail,
      password: 'wrong-password-lockout',
      _csrf: csrf
    });
  }
  const user = await models.User.findOne({ where: { email: lockoutEmail } });
  expect(user.failed_login_count).toBeGreaterThanOrEqual(5);
  expect(user.locked_until).toBeTruthy();
  await user.destroy({ force: true });
});

test('repeated failed logins from one IP are throttled', async () => {
  await models.SecuritySetting.upsert({
    key: 'login_max_ip_attempts',
    value: '3',
    enabled: true
  });
  await models.SecuritySetting.upsert({
    key: 'login_attempt_limiter',
    value: 'true',
    enabled: true
  });
  loginBruteForce.clearSettingsCache();

  try {
    const agent = request.agent(app);
    for (let i = 0; i < 3; i++) {
      const page = await agent.get('/admin/login');
      const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
      await agent.post('/admin/login').type('form').send({
        email: `unknown-${i}@test.local`,
        password: 'wrong-password',
        _csrf: csrf
      });
    }

    const page = await agent.get('/admin/login');
    const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
    const blocked = await agent.post('/admin/login').type('form').send({
      email: 'admin@example.com',
      password: 'wrong-password',
      _csrf: csrf
    });
    expect(blocked.status).toBe(302);
    expect(blocked.headers.location).toMatch(/^\/admin\/login/);
  } finally {
    await models.SecuritySetting.upsert({
      key: 'login_max_ip_attempts',
      value: '10',
      enabled: true
    });
    await models.SecuritySetting.upsert({
      key: 'login_attempt_limiter',
      value: 'false',
      enabled: false
    });
    await models.LoginAttempt.destroy({
      where: {
        ip_address: ['::ffff:127.0.0.1', '127.0.0.1', '::1']
      },
      force: true
    });
    loginBruteForce.clearSettingsCache();
  }
});
