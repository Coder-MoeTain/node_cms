const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');
const { listRevisions, saveRevision } = require('../utils/revisionHelper');

let adminAgent;
let subscriberAgent;
let typeSlug;

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  for (const slug of ['manage_custom_fields', 'manage_custom_content', 'manage_custom_post_types', 'manage_posts', 'manage_pages']) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
  const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
  const perms = await models.Permission.findAll({
    where: { slug: ['manage_custom_fields', 'manage_custom_content', 'manage_custom_post_types', 'manage_posts', 'manage_pages'] }
  });
  if (role) await role.addPermissions(perms);

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

  typeSlug = `loop3-jobs-${Date.now()}`;
  await models.CustomPostType.create({
    name: 'Loop Jobs',
    slug: typeSlug,
    status: 'active',
    supports_title: true,
    supports_editor: true,
    supports_excerpt: true,
    supports_custom_fields: true,
    supports_revisions: true,
    has_archive: true,
    show_in_menu: true
  });
});

describe('admin field groups controller', () => {
  test('edit, update with synced fields, and delete field group', async () => {
    const groupSlug = `loop3-group-${Date.now()}`;
    const create = await postForm(adminAgent, '/admin/field-groups', {
      name: 'Loop Group',
      slug: groupSlug,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active',
      field_label: ['Department'],
      field_name: ['department'],
      field_type: ['text'],
      field_required: ['on']
    }, '/admin/field-groups/create');
    expect(create.status).toBe(302);

    const group = await models.FieldGroup.findOne({ where: { slug: groupSlug }, include: [{ model: models.CustomField, as: 'fields' }] });
    expect(group).toBeTruthy();
    expect(group.fields).toHaveLength(1);

    const edit = await adminAgent.get(`/admin/field-groups/${group.id}/edit`);
    expect(edit.status).toBe(200);
    expect(edit.text).toMatch(/Loop Group/);

    const update = await putForm(adminAgent, `/admin/field-groups/${group.id}`, {
      name: 'Loop Group Updated',
      slug: groupSlug,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active',
      field_id: [group.fields[0].id],
      field_label: ['Department', 'Salary Band'],
      field_name: ['department', 'salary_band'],
      field_type: ['text', 'select'],
      field_required: ['on', '']
    }, `/admin/field-groups/${group.id}/edit`);
    expect(update.status).toBe(302);

    await group.reload({ include: [{ model: models.CustomField, as: 'fields' }] });
    expect(group.name).toBe('Loop Group Updated');
    expect(group.fields).toHaveLength(2);
    expect(group.fields.some((field) => field.name === 'salary_band')).toBe(true);

    const csrf = await getCsrf(adminAgent, '/admin/field-groups');
    const destroy = await adminAgent
      .delete(`/admin/field-groups/${group.id}`)
      .type('form')
      .send({ _csrf: csrf });
    expect(destroy.status).toBe(302);
    expect(await models.FieldGroup.findByPk(group.id)).toBeNull();
  });

  test('subscriber is redirected away from field groups', async () => {
    const res = await subscriberAgent.get('/admin/field-groups');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

describe('admin custom content controller', () => {
  test('index supports search and status filters', async () => {
    const draftSlug = `draft-filter-${Date.now()}`;
    await models.Post.create({
      title: 'Filter Draft Job',
      slug: draftSlug,
      post_type: typeSlug,
      content: '<p>Draft body</p>',
      status: 'draft',
      author_id: 1
    });

    const index = await adminAgent.get(`/admin/content/${typeSlug}`);
    expect(index.status).toBe(200);
    expect(index.text).toMatch(/Loop Jobs/);

    const filtered = await adminAgent.get(`/admin/content/${typeSlug}?status=draft&q=Filter`);
    expect(filtered.status).toBe(200);
    expect(filtered.text).toMatch(/Filter Draft Job/);
  });

  test('create, edit, update with revision, block content, and delete custom item', async () => {
    const itemSlug = `loop3-item-${Date.now()}`;
    const blockJson = JSON.stringify([{ type: 'paragraph', content: 'Block intro' }]);

    const store = await postForm(adminAgent, `/admin/content/${typeSlug}`, {
      title: 'Loop Job Opening',
      slug: itemSlug,
      content: '<p>Fallback</p>',
      excerpt: 'Great role',
      status: 'published',
      content_format: 'block',
      block_content_json: blockJson,
      seo_title: 'Loop SEO',
      seo_description: 'Loop description'
    }, `/admin/content/${typeSlug}/create`);
    expect(store.status).toBe(302);

    const record = await models.Post.findOne({ where: { slug: itemSlug, post_type: typeSlug } });
    expect(record).toBeTruthy();
    expect(record.content_format).toBe('block');
    expect(record.rendered_content_cache).toMatch(/Block intro/);

    const edit = await adminAgent.get(`/admin/content/${typeSlug}/${record.id}/edit`);
    expect(edit.status).toBe(200);
    expect(edit.text).toMatch(/Loop Job Opening/);

    const beforeRevisions = await listRevisions('custom_post', record.id);
    const update = await putForm(adminAgent, `/admin/content/${typeSlug}/${record.id}`, {
      title: 'Loop Job Opening v2',
      slug: itemSlug,
      content: '<p>Updated HTML</p>',
      excerpt: 'Updated excerpt',
      status: 'published'
    }, `/admin/content/${typeSlug}/${record.id}/edit`);
    expect(update.status).toBe(302);

    await record.reload();
    expect(record.title).toBe('Loop Job Opening v2');
    const afterRevisions = await listRevisions('custom_post', record.id);
    expect(afterRevisions.length).toBeGreaterThan(beforeRevisions.length);

    const csrf = await getCsrf(adminAgent, `/admin/content/${typeSlug}`);
    const destroy = await adminAgent
      .delete(`/admin/content/${typeSlug}/${record.id}`)
      .type('form')
      .send({ _csrf: csrf });
    expect(destroy.status).toBe(302);
    expect(await models.Post.findByPk(record.id)).toBeNull();
  });

  test('unknown custom post type returns 404', async () => {
    const res = await adminAgent.get('/admin/content/not-a-real-type');
    expect(res.status).toBe(404);
  });

  test('subscriber is redirected away from custom content admin', async () => {
    const res = await subscriberAgent.get(`/admin/content/${typeSlug}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

describe('admin revision controller', () => {
  test('index redirects when resource_id is missing', async () => {
    const res = await adminAgent.get('/admin/revisions');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('compare page renders two revision snapshots', async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const post = await models.Post.create({
      title: 'Compare Post',
      slug: `compare-post-${Date.now()}`,
      content: '<p>Left version</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id
    });
    await saveRevision('post', post.id, {
      title: 'Compare Post',
      content: '<p>Left version</p>',
      excerpt: 'left'
    }, admin.id);
    await saveRevision('post', post.id, {
      title: 'Compare Post v2',
      content: '<p>Right version</p>',
      excerpt: 'right'
    }, admin.id);
    const revisions = await models.Revision.findAll({
      where: { resource_type: 'post', resource_id: post.id },
      order: [['created_at', 'ASC']]
    });
    const left = revisions[0];
    const right = revisions[1];
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();

    const res = await adminAgent.get(`/admin/revisions/compare?left=${left.id}&right=${right.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Compare Revisions/);
    expect(res.text).toMatch(/Left version/);
    expect(res.text).toMatch(/Right version/);
  });

  test('compare redirects when revisions are missing', async () => {
    const res = await adminAgent.get('/admin/revisions/compare?left=999999&right=999998');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('restore reverts page content from revision', async () => {
    const page = await models.Page.create({
      title: 'Revision Page',
      slug: `revision-page-${Date.now()}`,
      content: '<p>Version A</p>',
      status: 'published',
      published_at: new Date()
    });
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    await saveRevision('page', page.id, {
      title: 'Revision Page',
      content: '<p>Version A</p>',
      excerpt: ''
    }, admin.id);
    const revision = await models.Revision.findOne({
      where: { resource_type: 'page', resource_id: page.id },
      order: [['created_at', 'DESC']]
    });
    expect(revision).toBeTruthy();
    await page.update({ content: '<p>Version B</p>' });

    const csrf = await getCsrf(adminAgent, `/admin/revisions?resource_type=page&resource_id=${page.id}`);
    const restore = await adminAgent
      .post(`/admin/revisions/${revision.id}/restore?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf)
      .type('form')
      .send({ _csrf: csrf });
    expect(restore.status).toBe(302);

    await page.reload();
    expect(page.content).toMatch(/Version A/);
  });

  test('custom_post revisions list and restore via admin UI', async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const itemSlug = `revision-cpt-${Date.now()}`;
    const record = await models.Post.create({
      title: 'Revision CPT Item',
      slug: itemSlug,
      post_type: typeSlug,
      content: '<p>Original CPT</p>',
      status: 'published',
      author_id: admin.id,
      published_at: new Date()
    });
    await saveRevision('custom_post', record.id, {
      title: 'Revision CPT Item',
      content: '<p>Original CPT</p>',
      excerpt: 'orig'
    }, admin.id);
    const revision = await models.Revision.findOne({
      where: { resource_type: 'custom_post', resource_id: record.id },
      order: [['created_at', 'DESC']]
    });
    expect(revision).toBeTruthy();
    await record.update({ content: '<p>Changed CPT</p>' });

    const list = await adminAgent.get(`/admin/revisions?resource_type=custom_post&resource_id=${record.id}`);
    expect(list.status).toBe(200);
    expect(list.text).toMatch(/Revision CPT Item/);

    const csrf = await getCsrf(adminAgent, `/admin/revisions?resource_type=custom_post&resource_id=${record.id}`);
    const restore = await adminAgent
      .post(`/admin/revisions/${revision.id}/restore?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf)
      .type('form')
      .send({ _csrf: csrf });
    expect(restore.status).toBe(302);

    await record.reload();
    expect(record.content).toMatch(/Original CPT/);
  });
});

describe('customContentController exports', () => {
  test('loadType throws 404 for inactive type slug', async () => {
    const { loadType } = require('../controllers/admin/customContentController');
    const inactiveSlug = `inactive-${Date.now()}`;
    await models.CustomPostType.create({
      name: 'Inactive',
      slug: inactiveSlug,
      status: 'inactive'
    });
    await expect(loadType({ params: { typeSlug: inactiveSlug } })).rejects.toMatchObject({ status: 404 });
  });
});
