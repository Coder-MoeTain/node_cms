const request = require('supertest');
const appConfig = require('../config/app');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { siteResolver } = require('../middleware/siteResolver');

describe('Multisite / network mode', () => {
  const originalMultisite = appConfig.multisiteEnabled;

  afterEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

  test('siteResolver leaves currentSite null when multisite disabled', async () => {
    appConfig.multisiteEnabled = false;
    const req = { get: () => 'localhost' };
    const res = { locals: {} };
    let nextCalled = false;
    await siteResolver(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.locals.currentSite).toBeNull();
  });

  test('network admin is blocked when multisite disabled', async () => {
    appConfig.multisiteEnabled = false;
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/network');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/admin/);
  });

  test('single-site routes still work when multisite flag is off', async () => {
    appConfig.multisiteEnabled = false;
    const home = await request(app).get('/');
    expect([200, 302]).toContain(home.status);
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
  });

  test('siteResolver resolves site by domain when multisite enabled', async () => {
    appConfig.multisiteEnabled = true;
    const site = await models.Site.create({
      name: 'Branch Portal',
      slug: `branch-${Date.now()}`,
      domain: 'branch.test',
      path: '/',
      status: 'active'
    });
    await models.SiteDomain.create({ site_id: site.id, domain: 'branch.test', is_primary: true });

    const req = { get: (h) => (h === 'host' ? 'branch.test:3000' : null) };
    const res = { locals: {} };
    await siteResolver(req, res, () => {});
    expect(res.locals.currentSite).toBeTruthy();
    expect(res.locals.currentSite.slug).toBe(site.slug);

    await models.SiteDomain.destroy({ where: { site_id: site.id } });
    await site.destroy();
  });

  test('super admin can manage network when multisite enabled', async () => {
    appConfig.multisiteEnabled = true;
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');

    const index = await agent.get('/admin/network');
    expect(index.status).toBe(200);
    expect(index.text).toMatch(/Network/i);

    const csrf = await getCsrf(agent, '/admin/network/create');
    const slug = `site-${Date.now()}`;
    const create = await agent.post('/admin/network').type('form').send({
      name: 'Regional Site',
      slug,
      domain: `${slug}.local`,
      path: '/',
      _csrf: csrf
    });
    expect(create.status).toBe(302);

    const row = await models.Site.findOne({ where: { slug } });
    expect(row).toBeTruthy();
    const domain = await models.SiteDomain.findOne({ where: { site_id: row.id } });
    expect(domain.domain).toBe(`${slug}.local`);

    await models.SiteDomain.destroy({ where: { site_id: row.id } });
    await row.destroy();
  });
});
