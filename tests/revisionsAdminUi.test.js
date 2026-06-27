const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { saveRevision } = require('../utils/revisionHelper');

describe('Revisions admin UI', () => {
  let postId;

  beforeAll(async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const post = await models.Post.create({
      title: 'Revision UI Post',
      slug: `revision-ui-${Date.now()}`,
      content: '<p>Current</p>',
      status: 'draft',
      post_type: 'post',
      author_id: admin.id
    });
    postId = post.id;
    await saveRevision('post', postId, { title: 'Revision UI Post', content: '<p>Old</p>' }, admin.id);
    await saveRevision('post', postId, { title: 'Revision UI Post v2', content: '<p>Newer</p>' }, admin.id);
  });

  test('revisions list shows compare controls', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get(`/admin/revisions?resource_type=post&resource_id=${postId}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/compare-revisions-btn/);
    expect(res.text).toMatch(/revision-compare-check/);
  });

  test('post edit form links to revisions', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get(`/admin/posts/${postId}/edit`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/View revisions/);
  });

  test('page revision restore includes block_content_json', async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const page = await models.Page.create({
      title: 'Block Page',
      slug: `block-page-${Date.now()}`,
      content: '<p>Rendered</p>',
      block_content_json: JSON.stringify([{ type: 'paragraph', content: 'Block body' }]),
      content_format: 'block',
      status: 'draft'
    });
    const revision = await models.Revision.create({
      resource_type: 'page',
      resource_id: page.id,
      title: 'Block Page',
      content: '<p>Old render</p>',
      block_content_json: JSON.stringify([{ type: 'paragraph', content: 'Restored block' }]),
      created_by: admin.id
    });
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, `/admin/revisions?resource_type=page&resource_id=${page.id}`);
    const restore = await agent
      .post(`/admin/revisions/${revision.id}/restore?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf)
      .type('form')
      .send({ _csrf: csrf });
    expect(restore.status).toBe(302);
    await page.reload();
    expect(page.block_content_json).toMatch(/Restored block/);
  });
});
