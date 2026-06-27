const request = require('supertest');
const appConfig = require('../config/app');
const { app, models } = require('../server');
const { login, getCsrf, postForm } = require('./helpers');
const { setNetworkSiteSetting } = require('../utils/networkSiteSettings');

describe('multisite site scope', () => {
  const originalMultisite = appConfig.multisiteEnabled;
  let siteA;
  let siteB;
  let domainA;
  let domainB;
  let admin;

  beforeAll(async () => {
    admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const stamp = Date.now();
    domainA = `loop7-a-${stamp}.test`;
    domainB = `loop7-b-${stamp}.test`;
    siteA = await models.Site.create({
      name: 'Loop7 Site A',
      slug: `loop7-a-${stamp}`,
      domain: domainA,
      path: '/',
      status: 'active'
    });
    siteB = await models.Site.create({
      name: 'Loop7 Site B',
      slug: `loop7-b-${stamp}`,
      domain: domainB,
      path: '/',
      status: 'active'
    });
    await models.SiteDomain.create({ site_id: siteA.id, domain: domainA, is_primary: true });
    await models.SiteDomain.create({ site_id: siteB.id, domain: domainB, is_primary: true });
  });

  afterAll(async () => {
    await models.Post.destroy({ where: { slug: { [require('sequelize').Op.like]: 'loop7-%' } }, force: true });
    await models.NetworkSiteSetting.destroy({ where: { site_id: [siteA.id, siteB.id] } });
    await models.SiteDomain.destroy({ where: { site_id: [siteA.id, siteB.id] } });
    await siteA.destroy();
    await siteB.destroy();
  });

  beforeEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

  afterEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

  test('site-scoped posts are only visible on their network site', async () => {
    appConfig.multisiteEnabled = true;
    const slugA = `loop7-post-a-${Date.now()}`;
    const slugB = `loop7-post-b-${Date.now()}`;

    await models.Post.create({
      title: 'Loop7 Site A Post',
      slug: slugA,
      content: '<p>Site A only</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id,
      site_id: siteA.id,
      published_at: new Date()
    });
    await models.Post.create({
      title: 'Loop7 Site B Post',
      slug: slugB,
      content: '<p>Site B only</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id,
      site_id: siteB.id,
      published_at: new Date()
    });

    const onA = await request(app).get(`/post/${slugA}`).set('Host', domainA);
    expect(onA.status).toBe(200);
    expect(onA.text).toMatch(/Site A only/);

    const crossA = await request(app).get(`/post/${slugA}`).set('Host', domainB);
    expect(crossA.status).toBe(404);

    const onB = await request(app).get(`/post/${slugB}`).set('Host', domainB);
    expect(onB.status).toBe(200);
    expect(onB.text).toMatch(/Site B only/);
  });

  test('legacy posts without site_id remain visible on all sites', async () => {
    appConfig.multisiteEnabled = true;
    const slug = `loop7-shared-${Date.now()}`;
    await models.Post.create({
      title: 'Loop7 Shared Post',
      slug,
      content: '<p>Shared across sites</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id,
      site_id: null,
      published_at: new Date()
    });

    const resA = await request(app).get(`/post/${slug}`).set('Host', domainA);
    const resB = await request(app).get(`/post/${slug}`).set('Host', domainB);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.text).toMatch(/Shared across sites/);
    expect(resB.text).toMatch(/Shared across sites/);
  });

  test('network site settings overlay public branding per domain', async () => {
    appConfig.multisiteEnabled = true;
    await setNetworkSiteSetting(siteA.id, 'public_site_title', 'Portal Alpha');
    await setNetworkSiteSetting(siteB.id, 'public_site_title', 'Portal Beta');

    const resA = await request(app).get('/').set('Host', domainA);
    const resB = await request(app).get('/').set('Host', domainB);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.text).toMatch(/Portal Alpha/);
    expect(resB.text).toMatch(/Portal Beta/);
    expect(resA.text).not.toMatch(/Portal Beta/);
  });

  test('super admin can save network site settings in admin UI', async () => {
    appConfig.multisiteEnabled = true;
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');

    const form = await agent.get(`/admin/network/${siteA.id}/settings`);
    expect(form.status).toBe(200);
    expect(form.text).toMatch(/Network Settings/i);

    const save = await postForm(agent, `/admin/network/${siteA.id}/settings`, {
      public_site_title: 'Portal Alpha Admin',
      public_site_tagline: 'Updated from admin'
    }, `/admin/network/${siteA.id}/settings`);
    expect(save.status).toBe(302);

    const publicRes = await request(app).get('/').set('Host', domainA);
    expect(publicRes.text).toMatch(/Portal Alpha Admin/);
  });
});
