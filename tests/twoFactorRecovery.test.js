const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const request = require('supertest');
const { app, models } = require('../server');
const { login, logout, getCsrf } = require('./helpers');
const { generateRecoveryCodes, replaceRecoveryCodes, consumeRecoveryCode } = require('../utils/twoFactorRecovery');

const TWO_FA_EMAIL = 'twofa-recovery@test.local';

beforeAll(async () => {
  const [role] = await models.Role.findOrCreate({
    where: { slug: 'super-admin' },
    defaults: { name: 'Super Admin' }
  });
  const [user] = await models.User.findOrCreate({
    where: { email: TWO_FA_EMAIL },
    defaults: {
      name: '2FA Recovery Test',
      email: TWO_FA_EMAIL,
      password: await bcrypt.hash('TwoFa@12345', 12),
      role_id: role.id,
      status: 'active',
      force_password_change: false
    }
  });
  const secret = speakeasy.generateSecret({ length: 20 });
  await user.update({
    two_factor_enabled: true,
    two_factor_secret: secret.base32,
    force_password_change: false
  });
  const codes = generateRecoveryCodes(3);
  await replaceRecoveryCodes(user.id, codes);
  global.__twoFaTest = { user, secret, codes };
});

afterAll(async () => {
  await models.User.destroy({ where: { email: TWO_FA_EMAIL }, force: true });
});

test('login accepts a one-time recovery code', async () => {
  const { codes } = global.__twoFaTest;
  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const response = await agent.post('/admin/login').type('form').send({
    email: TWO_FA_EMAIL,
    password: 'TwoFa@12345',
    recovery_code: codes[0],
    _csrf: csrf
  });
  expect(response.status).toBe(302);
  expect(response.headers.location).not.toMatch(/\/admin\/login/);

  await logout(agent);

  const agent2 = request.agent(app);
  const csrf2 = await getCsrf(agent2, '/admin/login');
  const reuse = await agent2.post('/admin/login').type('form').send({
    email: TWO_FA_EMAIL,
    password: 'TwoFa@12345',
    recovery_code: codes[0],
    _csrf: csrf2
  });
  expect(reuse.status).toBe(302);
  expect(String(reuse.headers.location || '')).toMatch(/\/admin\/login/);
});

test('recovery code utilities hash and consume once', async () => {
  const { user } = global.__twoFaTest;
  const codes = generateRecoveryCodes(2);
  await replaceRecoveryCodes(user.id, codes);
  expect(await consumeRecoveryCode(user.id, codes[0])).toBe(true);
  expect(await consumeRecoveryCode(user.id, codes[0])).toBe(false);
});
