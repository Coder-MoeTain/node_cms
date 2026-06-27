const request = require('supertest');
const appConfig = require('../config/app');
const { app, models } = require('../server');

describe('multisite API v1 scope', () => {
  const originalMultisite = appConfig.multisiteEnabled;
  let siteA;
  let siteB;
  let domainA;
  let domainB;
  let admin;

  beforeAll(async () => {
    admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const stamp = Date.now();
    domainA = `loop8-api-a-${stamp}.test`;
    domainB = `loop8-api-b-${stamp}.test`;
    siteA = await models.Site.create({
      name: 'Loop8 API Site A',
      slug: `loop8-api-a-${stamp}`,
      domain: domainA,
      path: '/',
      status: 'active'
    });
    siteB = await models.Site.create({
      name: 'Loop8 API Site B',
      slug: `loop8-api-b-${stamp}`,
      domain: domainB,
      path: '/',
      status: 'active'
    });
    await models.SiteDomain.create({ site_id: siteA.id, domain: domainA, is_primary: true });
    await models.SiteDomain.create({ site_id: siteB.id, domain: domainB, is_primary: true });
  });

  afterAll(async () => {
    await models.Post.destroy({ where: { slug: { [require('sequelize').Op.like]: 'loop8-api-%' } }, force: true });
    await models.CustomPostType.destroy({ where: { slug: { [require('sequelize').Op.like]: 'loop8-api-%' } }, force: true });
    await models.Tag.destroy({ where: { slug: { [require('sequelize').Op.like]: 'loop8-api-%' } }, force: true });
    await models.SiteDomain.destroy({ where: { site_id: [siteA.id, siteB.id] } });
    await siteA.destroy();
    await siteB.destroy();
  });

  beforeEach(() => {
    appConfig.multisiteEnabled = true;
  });

  afterEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

  test('GET /api/v1/types returns only types for the resolved site', async () => {
    const typeSlug = `loop8-api-docs-${Date.now()}`;
    await models.CustomPostType.create({
      name: 'Loop8 API Docs',
      slug: typeSlug,
      status: 'active',
      show_in_api: true,
      site_id: siteA.id
    });

    const onA = await request(app).get('/api/v1/types').set('Host', domainA);
    expect(onA.status).toBe(200);
    expect(onA.body.data.some((row) => row.slug === typeSlug)).toBe(true);

    const onB = await request(app).get('/api/v1/types').set('Host', domainB);
    expect(onB.status).toBe(200);
    expect(onB.body.data.some((row) => row.slug === typeSlug)).toBe(false);
  });

  test('GET /api/v1/tags hides tags from other network sites', async () => {
    const tagSlug = `loop8-api-tag-${Date.now()}`;
    await models.Tag.create({
      name: 'Loop8 API Tag',
      slug: tagSlug,
      site_id: siteA.id
    });

    const onA = await request(app).get('/api/v1/tags').set('Host', domainA);
    expect(onA.status).toBe(200);
    expect(onA.body.data.some((row) => row.slug === tagSlug)).toBe(true);

    const onB = await request(app).get('/api/v1/tags').set('Host', domainB);
    expect(onB.status).toBe(200);
    expect(onB.body.data.some((row) => row.slug === tagSlug)).toBe(false);
  });

  test('GET /api/v1/posts/:slug returns 404 on the wrong site domain', async () => {
    const slug = `loop8-api-post-${Date.now()}`;
    await models.Post.create({
      title: 'Loop8 API Post',
      slug,
      content: '<p>scoped</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id,
      site_id: siteA.id,
      published_at: new Date()
    });

    const onA = await request(app).get(`/api/v1/posts/${slug}`).set('Host', domainA);
    expect(onA.status).toBe(200);
    expect(onA.body.data.slug).toBe(slug);

    const onB = await request(app).get(`/api/v1/posts/${slug}`).set('Host', domainB);
    expect(onB.status).toBe(404);
  });
});
