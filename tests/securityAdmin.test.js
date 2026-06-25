const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can view security dashboard', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/security');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Security/i);
});

test('admin can update security settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/security');
  const response = await agent
    .put('/admin/security/settings')
    .type('form')
    .send({
      login_attempt_limiter: 'on',
      csrf_protection: 'on',
      xss_protection: 'on',
      file_upload_validation: 'on',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const setting = await models.SecuritySetting.findOne({ where: { key: 'csrf_protection' } });
  expect(setting?.value).toBe('true');
});

test('admin can block and unblock an IP', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/security');
  const block = await agent
    .post('/admin/security/block-ip')
    .type('form')
    .send({ ip_address: '203.0.113.50', reason: 'Test block', _csrf: csrf });
  expect(block.status).toBe(302);
  const row = await models.BlockedIp.findOne({ where: { ip_address: '203.0.113.50' } });
  expect(row).toBeTruthy();
  const unblockCsrf = await getCsrf(agent, '/admin/security');
  const unblock = await agent.delete(`/admin/security/unblock-ip/${row.id}`).type('form').send({ _csrf: unblockCsrf });
  expect(unblock.status).toBe(302);
  await row.reload();
  expect(row.active).toBe(false);
});
