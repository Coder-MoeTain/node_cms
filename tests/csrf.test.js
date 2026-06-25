const request = require('supertest');
const { app } = require('../server');

describe('CSRF protection', () => {
  test('rejects POST without valid CSRF token', async () => {
    const agent = request.agent(app);
    await agent.get('/admin/login');
    const response = await agent.post('/admin/login').type('form').send({
      email: 'admin@example.com',
      password: 'wrong'
    });
    expect(response.status).toBe(403);
  });

  test('accepts POST with valid CSRF token from login form', async () => {
    const agent = request.agent(app);
    const page = await agent.get('/admin/login');
    const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(csrf).toBeTruthy();
    const response = await agent.post('/admin/login').type('form').send({
      email: 'admin@example.com',
      password: 'Admin@12345',
      _csrf: csrf
    });
    expect(response.status).toBe(302);
  });

  test('skips CSRF for API routes', async () => {
    const response = await request(app).get('/api/v1/comments');
    expect([200, 401]).toContain(response.status);
  });
});
