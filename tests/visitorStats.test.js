const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const {
  recordVisitorPageView,
  countPageViews,
  countUniqueVisitors,
  getDashboardStats,
  classifyBrowser,
  shouldTrackVisit,
  purgeOldRecords
} = require('../utils/visitorStatsHelper');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/',
    sessionID: 'sess-test-1',
    session: { id: 'sess-test-1' },
    clientIp: '203.0.113.10',
    get(name) {
      if (name === 'user-agent') return overrides.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0';
      if (name === 'referer') return overrides.referrer || 'https://example.com/home';
      return overrides.headers?.[name] || null;
    },
    res: { locals: { siteSettings: { visitor_tracking_enabled: 'true' } } },
    ...overrides
  };
}

describe('visitorStatsHelper', () => {
  test('shouldTrackVisit skips admin, assets, and bots', () => {
    expect(shouldTrackVisit(mockReq({ path: '/admin/posts' }))).toBe(false);
    expect(shouldTrackVisit(mockReq({ path: '/style.css' }))).toBe(false);
    expect(shouldTrackVisit(mockReq({ path: '/', userAgent: 'Googlebot/2.1' }))).toBe(false);
    expect(shouldTrackVisit(mockReq({ path: '/about' }))).toBe(true);
  });

  test('classifyBrowser groups common agents', () => {
    expect(classifyBrowser('Mozilla/5.0 Chrome/120.0.0.0')).toBe('Chrome');
    expect(classifyBrowser('Mozilla/5.0 Firefox/121.0')).toBe('Firefox');
    expect(classifyBrowser('Mozilla/5.0 Edg/120.0.0.0')).toBe('Edge');
  });

  test('records page views and aggregates stats', async () => {
    await models.VisitorPageView.destroy({ where: {}, truncate: true });
    const req = mockReq({ path: '/visitor-stats-test' });
    await recordVisitorPageView(req);
    await recordVisitorPageView({ ...req, sessionID: 'sess-test-2', session: { id: 'sess-test-2' } });

    expect(await countPageViews(null, 1)).toBe(2);
    expect(await countUniqueVisitors(null, 1)).toBe(2);

    const stats = await getDashboardStats({ currentSite: null }, { days: 7, timeZone: 'UTC' });
    expect(stats.totalViews).toBeGreaterThanOrEqual(2);
    expect(stats.topPages.some((row) => row.path === '/visitor-stats-test')).toBe(true);
  });

  test('purgeOldRecords removes stale rows', async () => {
    await models.VisitorPageView.create({
      path: '/old-view',
      viewed_at: new Date('2020-01-01T12:00:00Z')
    });
    const deleted = await purgeOldRecords(30);
    expect(deleted).toBeGreaterThanOrEqual(1);
  });
});

describe('visitor statistics admin', () => {
  beforeAll(async () => {
    await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  });

  test('admin can view visitor statistics page', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const page = await agent.get('/admin/visitor-stats');
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/Visitor Statistics|Page views/i);
  });

  test('public GET request records a tracked page view', async () => {
    await models.VisitorPageView.destroy({ where: { path: '/public-track-test' } });
    const before = await countPageViews(null, 1);
    const response = await request(app)
      .get('/public-track-test')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
    expect([200, 404]).toContain(response.status);
    const after = await countPageViews(null, 1);
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });

  test('admin can update visitor tracking settings', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/visitor-stats');
    const response = await agent.post('/admin/visitor-stats/settings').type('form').send({
      visitor_tracking_enabled: 'on',
      visitor_retention_days: '90',
      _csrf: csrf
    });
    expect(response.status).toBe(302);
    const setting = await models.SiteSetting.findOne({ where: { key: 'visitor_tracking_enabled', site_id: null } });
    expect(setting?.value).toBe('true');
  });

  test('admin can export visitor stats csv', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const response = await agent.get('/admin/visitor-stats/export.csv?days=7');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/i);
    expect(response.text).toMatch(/viewed_at,path,referrer,user_agent/);
  });
});
