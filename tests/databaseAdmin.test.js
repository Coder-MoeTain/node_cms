const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can view database backup page', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/settings/database');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Backup|Database/i);
  expect(page.text).toMatch(/Restore from SQL File/i);
  expect(page.text).toMatch(/restore-upload\?_csrf=/);
});

test('restore upload requires an sql file', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings/database');
  const response = await agent
    .post(`/admin/settings/database/restore-upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .type('form')
    .send({ _csrf: csrf });
  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/admin/settings/database');
  const page = await agent.get('/admin/settings/database');
  expect(page.text).toMatch(/Upload an \.sql file/i);
});

test('restore upload rejects non-sql files', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings/database');
  const response = await agent
    .post(`/admin/settings/database/restore-upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .attach('sql_file', Buffer.from('not sql'), { filename: 'backup.txt', contentType: 'text/plain' });
  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/admin/settings/database');
  const page = await agent.get('/admin/settings/database');
  expect(page.text).toMatch(/Only \.sql files are allowed/i);
});

test('restore upload accepts sql file and attempts restore', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings/database');
  const tmp = path.join(os.tmpdir(), `restore-${Date.now()}.sql`);
  fs.writeFileSync(tmp, 'SELECT 1;');

  const response = await agent
    .post(`/admin/settings/database/restore-upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .attach('sql_file', tmp, { filename: 'restore.sql', contentType: 'application/sql' });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/admin/login?restored=1');
  const page = await agent.get('/admin/login?restored=1');
  expect(page.text).toMatch(/Database restored successfully/i);
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
});
