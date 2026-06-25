const request = require('supertest');
const { app } = require('../server');
const { login, getCsrf } = require('./helpers');

test('plugin upload rejects non-zip archives', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/plugins');

  const response = await agent
    .post('/admin/plugins/upload')
    .set('x-csrf-token', csrf)
    .attach('archive', Buffer.from('not a zip'), 'plugin.txt');

  expect(response.status).toBeGreaterThanOrEqual(400);
});
