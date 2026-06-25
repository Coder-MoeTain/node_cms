const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf, putForm } = require('./helpers');
const { saveRevision, listRevisions } = require('../utils/revisionHelper');
const { saveAutosave, loadAutosave, deleteAutosave } = require('../utils/autosaveHelper');

describe('Revisions', () => {
  let postId;

  beforeAll(async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const post = await models.Post.create({
      title: 'Revision Seed Post',
      slug: `revision-seed-${Date.now()}`,
      content: '<p>Version 1</p>',
      status: 'published',
      post_type: 'post',
      author_id: admin.id
    });
    postId = post.id;
    await saveRevision('post', postId, {
      title: 'Revision Seed Post',
      content: '<p>Version 1</p>',
      excerpt: 'v1'
    }, admin.id);
    await models.Post.update({ content: '<p>Version 2</p>', title: 'Revision Seed Post v2' }, { where: { id: postId } });
  });

  test('listRevisions returns history newest first', async () => {
    const rows = await listRevisions('post', postId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].content).toMatch(/Version 1/);
  });

  test('admin revisions page lists snapshots', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get(`/admin/revisions?resource_type=post&resource_id=${postId}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Revision Seed Post/);
  });

  test('restore revision reverts post content', async () => {
    const revision = await models.Revision.findOne({
      where: { resource_type: 'post', resource_id: postId },
      order: [['created_at', 'ASC']]
    });
    expect(revision).toBeTruthy();

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, `/admin/revisions?resource_type=post&resource_id=${postId}`);
    const restore = await agent
      .post(`/admin/revisions/${revision.id}/restore?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf)
      .type('form')
      .send({ _csrf: csrf });
    expect(restore.status).toBe(302);

    const post = await models.Post.findByPk(postId);
    expect(post.content).toMatch(/Version 1/);
  });

  test('post update via admin creates a new revision', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const before = await listRevisions('post', postId);
    const countBefore = before.length;

    const update = await putForm(agent, `/admin/posts/${postId}`, {
      title: 'Revision Seed Post v3',
      slug: (await models.Post.findByPk(postId)).slug,
      content: '<p>Version 3</p>',
      status: 'published'
    }, `/admin/posts/${postId}/edit`);
    expect(update.status).toBe(302);

    const after = await listRevisions('post', postId);
    expect(after.length).toBeGreaterThan(countBefore);
  });
});

describe('Autosave recovery', () => {
  let postId;
  let userId;

  beforeAll(async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    userId = admin.id;
    const post = await models.Post.create({
      title: 'Autosave Post',
      slug: `autosave-${Date.now()}`,
      content: '<p>Published</p>',
      status: 'draft',
      post_type: 'post',
      author_id: userId
    });
    postId = post.id;
  });

  test('saveAutosave and loadAutosave round-trip draft JSON', async () => {
    const draft = { title: 'Draft title', content: '<p>Draft body</p>' };
    await saveAutosave('post', postId, draft, userId);
    const loaded = await loadAutosave('post', postId, userId);
    expect(loaded.title).toBe('Draft title');
    expect(loaded.content).toMatch(/Draft body/);
  });

  test('autosave API stores and returns draft for logged-in editor', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, `/admin/posts/${postId}/edit`);

    const store = await agent.post(`/admin/autosave?_csrf=${encodeURIComponent(csrf)}`).send({
      resource_type: 'post',
      resource_id: postId,
      draft_data: { title: 'API Draft', content: '<p>API body</p>' }
    });
    expect(store.status).toBe(200);
    expect(store.body.ok).toBe(true);

    const show = await agent.get(`/admin/autosave?resource_type=post&resource_id=${postId}`);
    expect(show.status).toBe(200);
    expect(show.body.draft.title).toBe('API Draft');
  });

  test('deleteAutosave clears recovered draft', async () => {
    await saveAutosave('post', postId, { title: 'To delete' }, userId);
    await deleteAutosave('post', postId, userId);
    const loaded = await loadAutosave('post', postId, userId);
    expect(loaded).toBeNull();

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, `/admin/posts/${postId}/edit`);
    const destroy = await agent.delete(`/admin/autosave?_csrf=${encodeURIComponent(csrf)}`).send({
      resource_type: 'post',
      resource_id: postId
    });
    expect(destroy.status).toBe(200);
    expect(destroy.body.ok).toBe(true);
  });
});
