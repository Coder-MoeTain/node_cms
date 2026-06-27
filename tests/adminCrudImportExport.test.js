const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');

let adminAgent;
let subscriberAgent;

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  for (const slug of [
    'manage_custom_post_types', 'manage_custom_content', 'manage_posts', 'manage_pages', 'manage_settings'
  ]) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
  const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
  const perms = await models.Permission.findAll({
    where: { slug: ['manage_custom_post_types', 'manage_custom_content', 'manage_posts', 'manage_pages', 'manage_settings'] }
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
});

describe('admin custom post types controller', () => {
  test('index search, seed defaults, update, duplicate, and guarded delete', async () => {
    const typeSlug = `loop4-docs-${Date.now()}`;
    const create = await postForm(adminAgent, '/admin/custom-post-types', {
      name: 'Loop4 Docs',
      slug: typeSlug,
      description: 'Documentation entries',
      icon: 'bi-book',
      supports_title: 'on',
      supports_editor: 'on',
      has_archive: 'on',
      show_in_menu: 'on',
      show_in_api: 'on',
      status: 'active'
    }, '/admin/custom-post-types/create');
    expect(create.status).toBe(302);

    const type = await models.CustomPostType.findOne({ where: { slug: typeSlug } });
    expect(type).toBeTruthy();

    const search = await adminAgent.get(`/admin/custom-post-types?q=${encodeURIComponent('Loop4')}`);
    expect(search.status).toBe(200);
    expect(search.text).toMatch(/Loop4 Docs/);

    const seed = await postForm(adminAgent, '/admin/custom-post-types/defaults', {}, '/admin/custom-post-types');
    expect(seed.status).toBe(302);

    const update = await putForm(adminAgent, `/admin/custom-post-types/${type.id}`, {
      name: 'Loop4 Docs Updated',
      slug: typeSlug,
      description: 'Updated docs type',
      icon: 'bi-journal',
      supports_title: 'on',
      supports_editor: 'on',
      supports_excerpt: 'on',
      status: 'active'
    }, `/admin/custom-post-types/${type.id}/edit`);
    expect(update.status).toBe(302);
    await type.reload();
    expect(type.name).toBe('Loop4 Docs Updated');

    const duplicate = await postForm(adminAgent, `/admin/custom-post-types/${type.id}/duplicate`, {}, '/admin/custom-post-types');
    expect(duplicate.status).toBe(302);
    const copy = await models.CustomPostType.findOne({ where: { slug: `${typeSlug}-copy` } });
    expect(copy).toBeTruthy();
    expect(copy.status).toBe('inactive');

    await models.Post.create({
      title: 'Doc Item',
      slug: `doc-item-${Date.now()}`,
      post_type: typeSlug,
      content: '<p>x</p>',
      status: 'draft',
      author_id: 1
    });
    const csrf = await getCsrf(adminAgent, '/admin/custom-post-types');
    const blocked = await adminAgent
      .delete(`/admin/custom-post-types/${type.id}`)
      .type('form')
      .send({ _csrf: csrf });
    expect(blocked.status).toBe(302);
    expect(await models.CustomPostType.findByPk(type.id)).toBeTruthy();

    await copy.destroy();
    await models.Post.destroy({ where: { post_type: typeSlug }, force: true });
    const removed = await adminAgent
      .delete(`/admin/custom-post-types/${type.id}`)
      .type('form')
      .send({ _csrf: csrf });
    expect(removed.status).toBe(302);
    expect(await models.CustomPostType.findByPk(type.id)).toBeNull();
  });

  test('subscriber is redirected away from custom post types', async () => {
    const res = await subscriberAgent.get('/admin/custom-post-types');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

describe('admin crud controller bulk and trash flows', () => {
  test('posts index filters, bulk publish, trash restore, and permanent delete', async () => {
    const draftA = await models.Post.create({
      title: 'Loop4 Draft A',
      slug: `loop4-draft-a-${Date.now()}`,
      content: '<p>A</p>',
      status: 'draft',
      post_type: 'post',
      author_id: 1
    });
    const draftB = await models.Post.create({
      title: 'Loop4 Draft B',
      slug: `loop4-draft-b-${Date.now()}`,
      content: '<p>B</p>',
      status: 'draft',
      post_type: 'post',
      author_id: 1
    });

    const filtered = await adminAgent.get('/admin/posts?status=draft&q=Loop4');
    expect(filtered.status).toBe(200);
    expect(filtered.text).toMatch(/Loop4 Draft A/);

    const publish = await postForm(adminAgent, '/admin/posts/bulk', {
      action: 'publish',
      ids: [String(draftA.id), String(draftB.id)]
    }, '/admin/posts');
    expect(publish.status).toBe(302);
    await draftA.reload();
    await draftB.reload();
    expect(draftA.status).toBe('published');
    expect(draftB.status).toBe('published');

    const csrf = await getCsrf(adminAgent, '/admin/posts');
    await adminAgent.delete(`/admin/posts/${draftA.id}`).type('form').send({ _csrf: csrf });
    const trashedView = await adminAgent.get('/admin/posts?trashed=1');
    expect(trashedView.status).toBe(200);
    expect(trashedView.text).toMatch(/Loop4 Draft A/);

    const restoreCsrf = await getCsrf(adminAgent, '/admin/posts?trashed=1');
    const restore = await adminAgent
      .post(`/admin/posts/${draftA.id}/restore`)
      .type('form')
      .send({ _csrf: restoreCsrf });
    expect(restore.status).toBe(302);
    expect((await models.Post.findByPk(draftA.id))?.deleted_at).toBeNull();

    await adminAgent.delete(`/admin/posts/${draftA.id}`).type('form').send({ _csrf: csrf });
    const bulkRestore = await postForm(adminAgent, '/admin/posts/bulk', {
      action: 'restore',
      ids: String(draftA.id),
      return_trashed: '1'
    }, '/admin/posts?trashed=1');
    expect(bulkRestore.status).toBe(302);
    expect((await models.Post.findByPk(draftA.id))?.deleted_at).toBeNull();

    await adminAgent.delete(`/admin/posts/${draftA.id}`).type('form').send({ _csrf: csrf });
    const forceDelete = await postForm(adminAgent, '/admin/posts/bulk', {
      action: 'delete',
      ids: String(draftA.id),
      return_trashed: '1'
    }, '/admin/posts?trashed=1');
    expect(forceDelete.status).toBe(302);
    expect(await models.Post.findByPk(draftA.id, { paranoid: false })).toBeNull();
  });

  test('post slug change records redirect and pages bulk draft action', async () => {
    const oldSlug = `loop4-old-${Date.now()}`;
    const post = await models.Post.create({
      title: 'Slug Redirect Post',
      slug: oldSlug,
      content: '<p>Body</p>',
      status: 'published',
      post_type: 'post',
      author_id: 1,
      published_at: new Date()
    });
    const newSlug = `loop4-new-${Date.now()}`;
    const update = await putForm(adminAgent, `/admin/posts/${post.id}`, {
      title: 'Slug Redirect Post',
      slug: newSlug,
      content: '<p>Body</p>',
      status: 'published'
    }, `/admin/posts/${post.id}/edit`);
    expect(update.status).toBe(302);

    const redirect = await models.SlugRedirect.findOne({
      where: { resource_type: 'post', old_slug: oldSlug }
    });
    expect(redirect).toBeTruthy();

    const page = await models.Page.create({
      title: 'Loop4 Page Draft',
      slug: `loop4-page-${Date.now()}`,
      content: '<p>Page</p>',
      status: 'draft'
    });
    const draftBulk = await postForm(adminAgent, '/admin/pages/bulk', {
      action: 'draft',
      ids: String(page.id)
    }, '/admin/pages');
    expect(draftBulk.status).toBe(302);
    await page.reload();
    expect(page.status).toBe('draft');
  });
});

describe('admin import/export controller', () => {
  test('export and import forms load for admin', async () => {
    const exportPage = await adminAgent.get('/admin/tools/export');
    expect(exportPage.status).toBe(200);
    expect(exportPage.text).toMatch(/Export/i);

    const importPage = await adminAgent.get('/admin/tools/import');
    expect(importPage.status).toBe(200);
    expect(importPage.text).toMatch(/Import/i);
  });

  test('import preview and dry-run import complete through admin UI', async () => {
    const importSlug = `loop4-import-${Date.now()}`;
    const payload = {
      version: '1.0',
      posts: [{
        title: 'Loop4 Imported Post',
        slug: importSlug,
        content: '<p>Imported via admin UI</p>',
        status: 'published',
        post_type: 'post'
      }],
      pages: []
    };
    const tmp = path.join(os.tmpdir(), `loop4-import-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(payload));

    const previewCsrf = await getCsrf(adminAgent, '/admin/tools/import');
    const preview = await adminAgent
      .post(`/admin/tools/import/preview?_csrf=${encodeURIComponent(previewCsrf)}`)
      .attach('file', tmp, { contentType: 'application/json', filename: 'loop4-import.json' });
    expect(preview.status).toBe(200);
    expect(preview.text).toMatch(/posts/i);
    fs.unlinkSync(tmp);

    const dryRun = await postForm(adminAgent, '/admin/tools/import', {
      dry_run: 'on'
    }, '/admin/tools/import');
    expect(dryRun.status).toBe(302);
    expect(await models.Post.findOne({ where: { slug: importSlug } })).toBeNull();

    const previewCsrf2 = await getCsrf(adminAgent, '/admin/tools/import');
    fs.writeFileSync(tmp, JSON.stringify(payload));
    await adminAgent
      .post(`/admin/tools/import/preview?_csrf=${encodeURIComponent(previewCsrf2)}`)
      .attach('file', tmp, { contentType: 'application/json', filename: 'loop4-import.json' });
    const run = await postForm(adminAgent, '/admin/tools/import', {}, '/admin/tools/import');
    expect(run.status).toBe(302);
    fs.unlinkSync(tmp);

    const imported = await models.Post.findOne({ where: { slug: importSlug } });
    expect(imported).toBeTruthy();
    expect(imported.title).toBe('Loop4 Imported Post');
  });

  test('import run without preview redirects with error', async () => {
    const res = await postForm(adminAgent, '/admin/tools/import', {}, '/admin/tools/import');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/tools/import');
  });

  test('subscriber is redirected away from import/export tools', async () => {
    const exportRes = await subscriberAgent.get('/admin/tools/export');
    expect(exportRes.status).toBe(302);
    expect(exportRes.headers.location).toBe('/');

    const importRes = await subscriberAgent.get('/admin/tools/import');
    expect(importRes.status).toBe(302);
    expect(importRes.headers.location).toBe('/');
  });
});
