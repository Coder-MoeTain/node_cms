const { publishScheduledContent } = require('../utils/scheduledPublisher');
const { app, models } = require('../server');

describe('scheduled publishing', () => {
  test('publishScheduledContent publishes due posts and pages', async () => {
    const past = new Date(Date.now() - 60_000);
    const post = await models.Post.create({
      title: 'Scheduled Post',
      slug: `scheduled-post-${Date.now()}`,
      content: '<p>Future</p>',
      status: 'scheduled',
      post_type: 'post',
      published_at: past
    });
    const page = await models.Page.create({
      title: 'Scheduled Page',
      slug: `scheduled-page-${Date.now()}`,
      content: '<p>Future page</p>',
      status: 'scheduled',
      published_at: past
    });

    const result = await publishScheduledContent();
    expect(result.posts).toBeGreaterThanOrEqual(1);
    expect(result.pages).toBeGreaterThanOrEqual(1);

    await post.reload();
    await page.reload();
    expect(post.status).toBe('published');
    expect(page.status).toBe('published');

    await post.destroy({ force: true });
    await page.destroy({ force: true });
  });
});

describe('trash and restore', () => {
  test('admin can trash and restore a post', async () => {
    const request = require('supertest');
    const { login, getCsrf, postForm } = require('./helpers');
    const slug = `trash-restore-${Date.now()}`;
    const post = await models.Post.create({
      title: 'Trash Me',
      slug,
      content: '<p>x</p>',
      status: 'draft',
      post_type: 'post'
    });

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/posts');
    const del = await agent
      .delete(`/admin/posts/${post.id}?_csrf=${encodeURIComponent(csrf)}`)
      .set('X-CSRF-Token', csrf);
    expect(del.status).toBe(302);

    const trashed = await models.Post.findByPk(post.id, { paranoid: false });
    expect(trashed.deleted_at).toBeTruthy();

    const restore = await postForm(agent, `/admin/posts/${post.id}/restore`, {}, '/admin/posts?trashed=1');
    expect(restore.status).toBe(302);

    const restored = await models.Post.findByPk(post.id);
    expect(restored).toBeTruthy();
    expect(restored.deleted_at).toBeFalsy();

    await post.destroy({ force: true });
  });
});
