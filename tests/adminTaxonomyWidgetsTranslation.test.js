const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');

async function postJson(agent, url, body, csrfPageUrl = '/admin') {
  const csrf = await getCsrf(agent, csrfPageUrl);
  return agent
    .post(`${url}?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .send(body);
}

let adminAgent;
let subscriberAgent;

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  const [subscriberRole] = await models.Role.findOrCreate({
    where: { slug: 'subscriber' },
    defaults: { name: 'Subscriber' }
  });
  await models.User.findOrCreate({
    where: { email: 'subscriber@test.local' },
    defaults: {
      name: 'Subscriber User',
      email: 'subscriber@test.local',
      password: await bcrypt.hash('Subscriber@12345', 12),
      role_id: subscriberRole.id,
      status: 'active',
      force_password_change: false
    }
  });

  adminAgent = request.agent(app);
  await login(adminAgent, 'admin@example.com', 'Admin@12345');

  subscriberAgent = request.agent(app);
  await login(subscriberAgent, 'subscriber@test.local', 'Subscriber@12345');
});

describe('admin taxonomies', () => {
  test('index and create pages load for admin', async () => {
    const index = await adminAgent.get('/admin/taxonomies');
    expect(index.status).toBe(200);
    expect(index.text).toMatch(/Taxonomies/i);

    const create = await adminAgent.get('/admin/taxonomies/create');
    expect(create.status).toBe(200);
    expect(create.text).toMatch(/Add Taxonomy/i);
  });

  test('subscriber is denied taxonomy management', async () => {
    const res = await subscriberAgent.get('/admin/taxonomies');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('admin can create taxonomy and terms', async () => {
    const slug = `topics-${Date.now()}`;
    const create = await postForm(adminAgent, '/admin/taxonomies', {
      name: 'Loop Topics',
      slug,
      description: 'Topic taxonomy',
      hierarchical: 'on',
      post_types: 'post',
      public: 'on',
      show_in_api: 'on',
      status: 'active'
    }, '/admin/taxonomies/create');
    expect(create.status).toBe(302);
    expect(create.headers.location).toBe('/admin/taxonomies');

    const taxonomy = await models.Taxonomy.findOne({ where: { slug } });
    expect(taxonomy).toBeTruthy();
    expect(taxonomy.hierarchical).toBe(true);

    const termsPage = await adminAgent.get(`/admin/taxonomies/${slug}/terms`);
    expect(termsPage.status).toBe(200);
    expect(termsPage.text).toMatch(/Loop Topics Terms/i);

    const termSlug = `featured-${Date.now()}`;
    const termRes = await postForm(adminAgent, `/admin/taxonomies/${slug}/terms`, {
      name: 'Featured Topic',
      slug: termSlug,
      description: 'Featured items',
      seo_title: 'Featured SEO',
      seo_description: 'Featured description'
    }, `/admin/taxonomies/${slug}/terms`);
    expect(termRes.status).toBe(302);
    expect(termRes.headers.location).toBe(`/admin/taxonomies/${slug}/terms`);

    const term = await models.TaxonomyTerm.findOne({
      where: { taxonomy_id: taxonomy.id, slug: termSlug }
    });
    expect(term).toBeTruthy();
    expect(term.seo_title).toBe('Featured SEO');
  });

  test('unknown taxonomy terms page returns 404', async () => {
    const res = await adminAgent.get('/admin/taxonomies/does-not-exist/terms');
    expect(res.status).toBe(404);
  });
});

describe('admin widgets', () => {
  test('widgets index and sidebar area load', async () => {
    const index = await adminAgent.get('/admin/widgets');
    expect(index.status).toBe(200);
    expect(index.text).toMatch(/Widgets|Widget areas/i);

    const area = await adminAgent.get('/admin/widgets/sidebar');
    expect(area.status).toBe(200);
    expect(area.text).toMatch(/Active widgets|sidebar/i);
  });

  test('subscriber is denied widget management', async () => {
    const res = await subscriberAgent.get('/admin/widgets');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('admin can seed defaults, add, update, reorder, and delete widgets', async () => {
    const sidebar = await models.WidgetArea.findOne({ where: { slug: 'sidebar' } });
    expect(sidebar).toBeTruthy();
    await models.WidgetInstance.destroy({ where: { widget_area_id: sidebar.id } });

    const seed = await postForm(adminAgent, '/admin/widgets/seed-defaults', {}, '/admin/widgets');
    expect(seed.status).toBe(302);
    expect(seed.headers.location).toBe('/admin/widgets/sidebar');

    const seeded = await models.WidgetInstance.count({ where: { widget_area_id: sidebar.id } });
    expect(seeded).toBeGreaterThanOrEqual(3);

    const add = await postForm(adminAgent, '/admin/widgets/sidebar', {
      widget_type: 'text',
      title: 'Loop Text Widget',
      content: 'Hello from loop 2',
      status: 'active'
    }, '/admin/widgets/sidebar');
    expect(add.status).toBe(302);

    const custom = await models.WidgetInstance.findOne({
      where: { widget_area_id: sidebar.id, title: 'Loop Text Widget' }
    });
    expect(custom).toBeTruthy();

    const update = await putForm(adminAgent, `/admin/widgets/instance/${custom.id}`, {
      title: 'Updated Loop Widget',
      content: 'Updated content',
      status: 'active'
    }, '/admin/widgets/sidebar');
    expect(update.status).toBe(302);
    await custom.reload();
    expect(custom.title).toBe('Updated Loop Widget');

    const siblings = await models.WidgetInstance.findAll({
      where: { widget_area_id: sidebar.id },
      order: [['display_order', 'ASC'], ['id', 'ASC']]
    });
    const second = siblings[1];
    const reorderCsrf = await getCsrf(adminAgent, '/admin/widgets/sidebar');
    const reorder = await adminAgent
      .post(`/admin/widgets/instance/${second.id}/reorder?_csrf=${encodeURIComponent(reorderCsrf)}`)
      .set('X-CSRF-Token', reorderCsrf)
      .set('Accept', 'application/json')
      .type('form')
      .send({ direction: 'up' });
    expect(reorder.status).toBe(200);
    expect(reorder.body.ok).toBe(true);

    const csrf = await getCsrf(adminAgent, '/admin/widgets/sidebar');
    const destroy = await adminAgent
      .delete(`/admin/widgets/instance/${custom.id}`)
      .type('form')
      .send({ _csrf: csrf });
    expect(destroy.status).toBe(302);
    expect(await models.WidgetInstance.findByPk(custom.id)).toBeNull();
  });

  test('reorder returns 403 for subscriber', async () => {
    const widget = await models.WidgetInstance.findOne();
    if (!widget) return;
    const res = await subscriberAgent
      .post(`/admin/widgets/instance/${widget.id}/reorder`)
      .set('Accept', 'application/json')
      .type('form')
      .send({ direction: 'up' });
    expect(res.status).toBe(403);
  });
});

describe('admin translate-content API', () => {
  test('admin receives translations for English content', async () => {
    const res = await postJson(adminAgent, '/admin/translate-content', {
      source_locale: 'en',
      fields: {
        title: 'Public Holidays',
        excerpt: 'Short note',
        content: '<p>Welcome</p>'
      }
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source_locale).toBe('en');
    expect(res.body.translations.en.title).toBe('Public Holidays');
    expect(res.body.translations.my.title).toBeTruthy();
    expect(res.body.translations['zh-CN'].title).toBeTruthy();
    expect(res.body.translations.ru.title).toBeTruthy();
  });

  test('rejects empty payload', async () => {
    const res = await postJson(adminAgent, '/admin/translate-content', { fields: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title or content/i);
  });

  test('rejects unauthenticated requests without CSRF token', async () => {
    const res = await request(app).post('/admin/translate-content').send({
      fields: { title: 'Hello', content: '' }
    });
    expect(res.status).toBe(403);
  });

  test('subscriber is redirected away from translate-content', async () => {
    const csrf = await getCsrf(subscriberAgent, '/contact');
    const res = await subscriberAgent
      .post(`/admin/translate-content?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf)
      .send({ fields: { title: 'Hello', content: '' } });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

describe('translationController unit exports', () => {
  test('canTranslateContent respects editor permissions', async () => {
    const { canTranslateContent, resolveSourceLocale } = require('../controllers/admin/translationController');
    const admin = await models.User.findOne({
      where: { email: 'admin@example.com' },
      include: [models.Role]
    });
    const subscriber = await models.User.findOne({
      where: { email: 'subscriber@test.local' },
      include: [models.Role]
    });
    expect(canTranslateContent(admin)).toBe(true);
    expect(canTranslateContent(subscriber)).toBe(false);
    await models.SiteSetting.upsert({ key: 'default_content_locale', value: 'my', group: 'general' });
    expect(await resolveSourceLocale({})).toBe('my');
    await models.SiteSetting.upsert({ key: 'default_content_locale', value: 'en', group: 'general' });
  });
});
