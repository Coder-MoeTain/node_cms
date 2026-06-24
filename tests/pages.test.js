const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can list pages', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/pages');
  expect(response.status).toBe(200);
});

test('admin can create and publish a page', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/pages/create');
  const slug = `test-page-${Date.now()}`;
  const response = await agent
    .post('/admin/pages')
    .type('form')
    .send({
      title: 'Phase 5 Test Page',
      slug,
      content: '<p>Page body</p>',
      status: 'published',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const page = await models.Page.findOne({ where: { slug } });
  expect(page).toBeTruthy();
  expect(page.status).toBe('published');

  const publicPage = await request(app).get(`/page/${slug}`);
  expect(publicPage.status).toBe(200);
  expect(publicPage.text).toMatch(/Phase 5 Test Page/);
});

test('admin can edit page SEO fields', async () => {
  const page = await models.Page.create({
    title: 'SEO Page',
    slug: `seo-page-${Date.now()}`,
    content: '<p>SEO</p>',
    status: 'draft'
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, `/admin/pages/${page.id}/edit`);
  const response = await agent
    .put(`/admin/pages/${page.id}`)
    .type('form')
    .send({
      title: 'SEO Page Updated',
      slug: page.slug,
      content: '<p>SEO updated</p>',
      status: 'draft',
      seo_title: 'Custom SEO Title',
      seo_description: 'Custom meta description',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  await page.reload();
  expect(page.seo_title).toBe('Custom SEO Title');
});

test('duplicate page slug gets unique suffix on create', async () => {
  const baseSlug = `dup-page-${Date.now()}`;
  await models.Page.create({
    title: 'Original Page',
    slug: baseSlug,
    content: '<p>One</p>',
    status: 'draft'
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/pages/create');
  await agent
    .post('/admin/pages')
    .type('form')
    .send({
      title: 'Original Page',
      slug: baseSlug,
      content: '<p>Two</p>',
      status: 'draft',
      _csrf: csrf
    });
  const pages = await models.Page.findAll({ where: { slug: [baseSlug, `${baseSlug}-2`] } });
  expect(pages.length).toBeGreaterThanOrEqual(2);
});

test('admin can delete a draft page', async () => {
  const page = await models.Page.create({
    title: 'Trash Page',
    slug: `trash-page-${Date.now()}`,
    content: '<p>Delete me</p>',
    status: 'draft'
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .delete(`/admin/pages/${page.id}`)
    .type('form')
    .send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const gone = await models.Page.findByPk(page.id);
  expect(gone).toBeNull();
});
