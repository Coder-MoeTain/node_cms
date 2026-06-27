const request = require('supertest');
const appConfig = require('../config/app');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { siteResolver } = require('../middleware/siteResolver');
const {
  getNetworkSiteSetting,
  setNetworkSiteSetting,
  listNetworkSiteSettings
} = require('../utils/networkSiteSettings');

describe('Multisite / network mode', () => {
  const originalMultisite = appConfig.multisiteEnabled;

  beforeEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

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

  test('network site settings are isolated per site', async () => {
    const siteA = await models.Site.create({
      name: 'Site A',
      slug: `site-a-${Date.now()}`,
      domain: null,
      path: '/',
      status: 'active'
    });
    const siteB = await models.Site.create({
      name: 'Site B',
      slug: `site-b-${Date.now()}`,
      domain: null,
      path: '/',
      status: 'active'
    });

    await setNetworkSiteSetting(siteA.id, 'public_site_title', 'Portal A');
    await setNetworkSiteSetting(siteB.id, 'public_site_title', 'Portal B');

    expect(await getNetworkSiteSetting(siteA.id, 'public_site_title')).toBe('Portal A');
    expect(await getNetworkSiteSetting(siteB.id, 'public_site_title')).toBe('Portal B');

    const settingsA = await listNetworkSiteSettings(siteA.id);
    expect(settingsA.some((row) => row.setting_key === 'public_site_title' && row.setting_value === 'Portal A')).toBe(true);

    await models.NetworkSiteSetting.destroy({ where: { site_id: [siteA.id, siteB.id] } });
    await siteA.destroy();
    await siteB.destroy();
  });
});
