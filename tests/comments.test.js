const request = require('supertest');
const { app, models } = require('../server');

let publishedPostId;

beforeAll(async () => {
  const [post] = await models.Post.findOrCreate({
    where: { slug: 'comment-test-post' },
    defaults: {
      title: 'Comment Test Post',
      slug: 'comment-test-post',
      content: '<p>Comments enabled</p>',
      status: 'published',
      allow_comments: true,
      published_at: new Date()
    }
  });
  publishedPostId = post.id;
  if (!post.allow_comments) {
    await post.update({ allow_comments: true, status: 'published' });
  }
});

test('visitor can submit a comment on a published post', async () => {
  const agent = request.agent(app);
  const page = await agent.get(`/post/comment-test-post`);
  expect(page.status).toBe(200);
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent
    .post(`/post/${publishedPostId}/comment`)
    .type('form')
    .send({
      name: 'Commenter',
      email: 'commenter@test.local',
      content: 'Great article from tests.',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const comment = await models.Comment.findOne({
    where: { email: 'commenter@test.local', post_id: publishedPostId }
  });
  expect(comment).toBeTruthy();
  expect(comment.content).toMatch(/Great article/);
});

test('admin can list comments', async () => {
  const agent = request.agent(app);
  const loginPage = await agent.get('/admin/login');
  const csrf = loginPage.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  await agent.post('/admin/login').type('form').send({
    email: 'admin@example.com',
    password: 'Admin@12345',
    _csrf: csrf
  });
  const response = await agent.get('/admin/comments');
  expect(response.status).toBe(200);
});
