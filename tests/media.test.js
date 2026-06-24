const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin media library loads', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/media');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Media/i);
});

test('admin can edit media metadata', async () => {
  const [media] = await models.Media.findOrCreate({
    where: { original_name: 'phase5-media-meta.jpg' },
    defaults: {
      original_name: 'phase5-media-meta.jpg',
      filename: 'phase5-media-meta.jpg',
      file_path: '/uploads/phase5-media-meta.jpg',
      file_type: 'image',
      mime_type: 'image/jpeg',
      file_size: 2048,
      uploaded_by: 1
    }
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, `/admin/media/${media.id}/edit`);
  const response = await agent
    .put(`/admin/media/${media.id}`)
    .type('form')
    .send({
      alt_text: 'Alt text for test',
      caption: 'Test caption',
      description: 'Test description',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  await media.reload();
  expect(media.alt_text).toBe('Alt text for test');
});

test('media gallery JSON endpoint returns items', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/settings/media-gallery?type=image');
  expect(response.status).toBe(200);
  expect(response.body.items).toEqual(expect.any(Array));
});

test('guest cannot access media library', async () => {
  const response = await request(app).get('/admin/media');
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/login/);
});
