const request = require('supertest');
const { app, models } = require('../server');
const { login } = require('./helpers');
const { shouldTrackPublicTraffic, parseUserAgent, recordTrafficHit } = require('../utils/trafficLogHelper');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('shouldTrackPublicTraffic skips admin and static assets', () => {
  expect(shouldTrackPublicTraffic({ method: 'GET', path: '/' })).toBe(true);
  expect(shouldTrackPublicTraffic({ method: 'GET', path: '/admin' })).toBe(false);
  expect(shouldTrackPublicTraffic({ method: 'GET', path: '/vendor/bootstrap/css/bootstrap.min.css' })).toBe(false);
  expect(shouldTrackPublicTraffic({ method: 'POST', path: '/' })).toBe(false);
});

test('parseUserAgent detects mobile Chrome on Android', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
  const parsed = parseUserAgent(ua);
  expect(parsed.deviceType).toBe('mobile');
  expect(parsed.browser).toBe('Chrome');
  expect(parsed.os).toBe('Android');
  expect(parsed.isBot).toBe(false);
});

test('public page visit is recorded and admin can view traffic log', async () => {
  const home = await request(app).get('/');
  expect([200, 301, 302, 503]).toContain(home.status);

  await recordTrafficHit({
    ip_address: '203.0.113.10',
    method: 'GET',
    path: '/test-traffic',
    url: '/test-traffic',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/121.0',
    response_status: 200,
    response_ms: 42
  });

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/traffic');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Public Traffic Log|Traffic Log/i);
  expect(page.text).toMatch(/test-traffic|203\.0\.113\.10/);
});

test('admin traffic stream requires authentication', async () => {
  const guest = await request(app).get('/admin/traffic/stream');
  expect(guest.status).toBe(302);
});

test('subscribeTrafficHits receives emitted hits', async () => {
  const { subscribeTrafficHits } = require('../utils/trafficLogHelper');
  const hits = [];
  const unsubscribe = subscribeTrafficHits((entry) => hits.push(entry));
  await recordTrafficHit({
    ip_address: '198.51.100.1',
    method: 'GET',
    path: '/emit-test',
    url: '/emit-test',
    response_status: 200,
    response_ms: 10
  });
  unsubscribe();
  expect(hits.some((h) => h.path === '/emit-test')).toBe(true);
});
