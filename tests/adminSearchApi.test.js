const request = require('supertest');
const { app } = require('../server');
const { login } = require('./helpers');

describe('Admin content search API', () => {
  test('GET /admin/api/search requires auth and returns JSON', async () => {
    const guest = await request(app).get('/admin/api/search?q=test');
    expect(guest.status).toBe(302);

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/api/search?q=post').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('posts');
    expect(res.body.data).toHaveProperty('pages');
    expect(res.body.data).toHaveProperty('media');
  });
});
