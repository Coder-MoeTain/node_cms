const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('security headers are present on public pages', async () => {
  const response = await request(app).get('/');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-frame-options']).toBeTruthy();
});

test('CSRF rejects admin mutation without token', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent
    .post('/admin/posts')
    .type('form')
    .send({ title: 'No CSRF', content: '<p>x</p>', status: 'draft' });
  expect(response.status).toBe(403);
});

test('XSS script tags are stripped from post content on save', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/posts/create');
  const slug = `xss-test-${Date.now()}`;
  await agent
    .post('/admin/posts')
    .type('form')
    .send({
      title: 'XSS Test Post',
      slug,
      content: '<p>Safe</p><script>alert(1)</script>',
      status: 'draft',
      _csrf: csrf
    });
  const post = await models.Post.findOne({ where: { slug } });
  expect(post.content).not.toMatch(/<script/i);
  expect(post.content).toMatch(/Safe/);
});

test('SQL injection in search query does not crash the app', async () => {
  const response = await request(app).get("/search?q=1' OR '1'='1");
  expect(response.status).toBeLessThan(500);
});

test('rate limit middleware is configured', () => {
  const { rateLimitMiddleware } = require('../middleware/rateLimit');
  expect(rateLimitMiddleware).toBeTruthy();
});

test('helmet CSP is applied on admin login', async () => {
  const response = await request(app).get('/admin/login');
  expect(response.headers['content-security-policy']).toBeTruthy();
});

test('buildCspDirectives allows Cloudflare Insights when configured', () => {
  const { buildCspDirectives } = require('../middleware/security');
  const previous = process.env.CSP_CLOUDFLARE_INSIGHTS;
  process.env.CSP_CLOUDFLARE_INSIGHTS = 'true';
  const directives = buildCspDirectives({ path: '/admin/plugins' }, { locals: {} });
  expect(directives.scriptSrc).toContain('https://static.cloudflareinsights.com');
  expect(directives.connectSrc).toContain('https://cloudflareinsights.com');
  if (previous === undefined) delete process.env.CSP_CLOUDFLARE_INSIGHTS;
  else process.env.CSP_CLOUDFLARE_INSIGHTS = previous;
});
