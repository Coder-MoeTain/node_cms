const speakeasy = require('speakeasy');
const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update(
    { force_password_change: false, two_factor_enabled: false, two_factor_secret: null },
    { where: { email: 'admin@example.com' } }
  );
});

afterEach(async () => {
  await models.User.update(
    { two_factor_enabled: false, two_factor_secret: null },
    { where: { email: 'admin@example.com' } }
  );
});

test('admin can open 2FA setup page', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/profile/2fa');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Two-Factor|2FA/i);
});

test('admin cannot enable 2FA with invalid token', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  await agent.get('/admin/profile/2fa');
  const csrf = await getCsrf(agent, '/admin/profile/2fa');
  const response = await agent
    .post('/admin/profile/2fa/enable')
    .type('form')
    .send({ token: '000000', _csrf: csrf });
  expect(response.status).toBe(302);
  const user = await models.User.findOne({ where: { email: 'admin@example.com' } });
  expect(user.two_factor_enabled).toBe(false);
});

test('login requires valid TOTP when 2FA is enabled', async () => {
  const secret = speakeasy.generateSecret({ length: 20 });
  await models.User.update(
    { two_factor_enabled: true, two_factor_secret: secret.base32 },
    { where: { email: 'admin@example.com' } }
  );
  const fresh = await models.User.findOne({ where: { email: 'admin@example.com' } });
  expect(fresh.two_factor_enabled).toBe(true);

  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const badLogin = await agent.post('/admin/login').type('form').send({
    email: 'admin@example.com',
    password: 'Admin@12345',
    _csrf: csrf
  });
  expect(badLogin.status).toBe(302);
  expect(badLogin.headers.location).toMatch(/\/admin\/login/);

  const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
  const goodLogin = await login(agent, 'admin@example.com', 'Admin@12345', token);
  expect(goodLogin.status).toBe(302);
  expect(goodLogin.headers.location).not.toMatch(/\/admin\/login/);
});

test('admin can disable 2FA', async () => {
  const user = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const secret = speakeasy.generateSecret({ length: 20 });
  await user.update({ two_factor_enabled: true, two_factor_secret: secret.base32 });
  const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345', token);
  const csrf = await getCsrf(agent, '/admin/profile/2fa');
  const response = await agent.post('/admin/profile/2fa/disable').type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  await user.reload();
  expect(user.two_factor_enabled).toBe(false);
  expect(user.two_factor_secret).toBeNull();
});
