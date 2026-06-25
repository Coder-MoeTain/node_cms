const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

describe('Custom Post Types', () => {
  let typeSlug;

  beforeAll(async () => {
    await models.Permission.findOrCreate({
      where: { slug: 'manage_custom_post_types' },
      defaults: { name: 'Manage Custom Post Types' }
    });
    await models.Permission.findOrCreate({
      where: { slug: 'manage_custom_content' },
      defaults: { name: 'Manage Custom Content' }
    });
    await models.Permission.findOrCreate({
      where: { slug: 'manage_custom_fields' },
      defaults: { name: 'Manage Custom Fields' }
    });
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
    const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
    const perms = await models.Permission.findAll({
      where: { slug: ['manage_custom_post_types', 'manage_custom_content', 'manage_custom_fields'] }
    });
    if (role) await role.addPermissions(perms);
  });

  test('admin can create a custom post type and publish content', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    typeSlug = `news-${Date.now()}`;

    const list = await agent.get('/admin/custom-post-types');
    expect(list.status).toBe(200);

    const csrfType = await getCsrf(agent, '/admin/custom-post-types/create');
    const typeRes = await agent.post('/admin/custom-post-types').type('form').send({
      name: 'Test News',
      slug: typeSlug,
      status: 'active',
      supports_title: 'on',
      supports_editor: 'on',
      has_archive: 'on',
      show_in_menu: 'on',
      show_in_api: 'on',
      _csrf: csrfType
    });
    expect(typeRes.status).toBe(302);

    const type = await models.CustomPostType.findOne({ where: { slug: typeSlug } });
    expect(type).toBeTruthy();
    expect(type.name).toBe('Test News');

    const csrfContent = await getCsrf(agent, `/admin/content/${typeSlug}/create`);
    const itemSlug = `item-${Date.now()}`;
    const saveRes = await agent.post(`/admin/content/${typeSlug}`).type('form').send({
      title: 'Breaking News Item',
      slug: itemSlug,
      content: '<p>Custom content body</p>',
      status: 'published',
      seo_title: 'SEO News',
      _csrf: csrfContent
    });
    expect(saveRes.status).toBe(302);

    const item = await models.Post.findOne({ where: { slug: itemSlug, post_type: typeSlug } });
    expect(item).toBeTruthy();
    expect(item.status).toBe('published');

    const archive = await request(app).get(`/types/${typeSlug}`);
    expect(archive.status).toBe(200);
    expect(archive.text).toMatch(/Breaking News Item/);

    const single = await request(app).get(`/types/${typeSlug}/${itemSlug}`);
    expect(single.status).toBe(200);
    expect(single.text).toMatch(/Custom content body/);
  });

  test('API v1 exposes custom post types and content', async () => {
    expect(typeSlug).toBeTruthy();
    const typesRes = await request(app).get('/api/v1/types');
    expect(typesRes.status).toBe(200);
    expect(typesRes.body.data.some((row) => row.slug === typeSlug)).toBe(true);

    const contentRes = await request(app).get(`/api/v1/types/${typeSlug}/content`);
    expect(contentRes.status).toBe(200);
    expect(Array.isArray(contentRes.body.data)).toBe(true);
    expect(contentRes.body.data.length).toBeGreaterThan(0);
  });
});

describe('Custom Fields', () => {
  test('admin can attach field group to custom post type and save values', async () => {
    const typeSlug = `events-${Date.now()}`;
    await models.CustomPostType.create({
      name: 'Events',
      slug: typeSlug,
      status: 'active',
      supports_custom_fields: true
    });

    const group = await models.FieldGroup.create({
      name: 'Event Details',
      slug: `event-details-${Date.now()}`,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active'
    });
    await models.CustomField.create({
      field_group_id: group.id,
      label: 'Event Date',
      name: 'event_date',
      type: 'date',
      is_required: true,
      status: 'active'
    });

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, `/admin/content/${typeSlug}/create`);
    const slug = `event-${Date.now()}`;
    const res = await agent.post(`/admin/content/${typeSlug}`).type('form').send({
      title: 'Town Hall',
      slug,
      content: '<p>Event</p>',
      status: 'published',
      cf_event_date: '2026-12-01',
      _csrf: csrf
    });
    expect(res.status).toBe(302);

    const post = await models.Post.findOne({ where: { slug, post_type: typeSlug } });
    const value = await models.CustomFieldValue.findOne({
      where: { resource_type: 'custom_post', resource_id: post.id },
      include: [models.CustomField]
    });
    expect(value).toBeTruthy();
    expect(value.value_text).toBe('2026-12-01');
  });
});

describe('Block renderer and shortcodes', () => {
  test('renderBlocks escapes unsafe content', () => {
    const { renderBlocks } = require('../utils/blockRenderer');
    const html = renderBlocks(JSON.stringify([
      { type: 'paragraph', content: '<script>alert(1)</script>' },
      { type: 'heading', content: 'Safe Title', attrs: { level: 2 } }
    ]));
    expect(html).not.toMatch(/<script>/);
    expect(html).toMatch(/Safe Title/);
  });

  test('parseShortcodes ignores unknown shortcodes', () => {
    const { parseShortcodes } = require('../utils/shortcodeParser');
    const input = '[unknown foo="bar"]';
    expect(parseShortcodes(input)).toBe(input);
    const button = parseShortcodes('[button url="https://example.com" label="Go"]');
    expect(button).toMatch(/href="https:\/\/example.com"/);
  });
});
