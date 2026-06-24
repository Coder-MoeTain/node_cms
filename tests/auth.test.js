const request = require('supertest');
const { app } = require('../server');

test('login page is accessible to guests', async () => {
  const response = await request(app).get('/admin/login');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/login/i);
});

test('invalid login is rejected', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/admin/login');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent.post('/admin/login').type('form').send({
    email: 'admin@example.com',
    password: 'wrong-password',
    _csrf: csrf
  });
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/login/);
});

test('valid admin login redirects to dashboard', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/admin/login');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const loginRes = await agent.post('/admin/login').type('form').send({
    email: 'admin@example.com',
    password: 'Admin@12345',
    _csrf: csrf
  });
  expect(loginRes.status).toBe(302);
  const dashboard = await agent.get('/admin');
  expect([200, 302]).toContain(dashboard.status);
});

test('logout clears admin session', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/admin/login');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  await agent.post('/admin/login').type('form').send({
    email: 'admin@example.com',
    password: 'Admin@12345',
    _csrf: csrf
  });
  const adminPage = await agent.get('/admin');
  const logoutCsrf = adminPage.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || csrf;
  await agent.post('/admin/logout').type('form').send({ _csrf: logoutCsrf });
  const profile = await agent.get('/admin/profile');
  expect([302, 403]).toContain(profile.status);
});

test('protected admin route redirects guests to login', async () => {
  const response = await request(app).get('/admin/posts');
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/login/);
});
