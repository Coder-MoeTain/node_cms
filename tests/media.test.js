const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf, putForm, TEST_IMAGE, writeTestUpload, removeTestUpload } = require('./helpers');

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
  writeTestUpload('/uploads/phase5-media-meta.jpg');
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
  const response = await putForm(agent, `/admin/media/${media.id}`, {
    alt_text: 'Alt text for test',
    caption: 'Test caption',
    description: 'Test description'
  }, `/admin/media/${media.id}/edit`);
  expect(response.status).toBe(302);
  await media.reload();
  expect(media.alt_text).toBe('Alt text for test');
});

test('media gallery JSON endpoint returns items', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/media/gallery?type=image');
  expect(response.status).toBe(200);
  expect(response.body.items).toEqual(expect.any(Array));
  expect(response.body).toMatchObject({
    page: 1,
    limit: expect.any(Number),
    total: expect.any(Number),
    hasMore: expect.any(Boolean)
  });
});

test('media gallery JSON supports pagination', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page1 = await agent.get('/admin/media/gallery?type=image&page=1&limit=2');
  expect(page1.status).toBe(200);
  expect(page1.body.limit).toBe(2);
  if (page1.body.total > 2) {
    expect(page1.body.hasMore).toBe(true);
    const page2 = await agent.get('/admin/media/gallery?type=image&page=2&limit=2');
    expect(page2.status).toBe(200);
    expect(page2.body.page).toBe(2);
    const ids1 = page1.body.items.map((item) => item.id);
    const ids2 = page2.body.items.map((item) => item.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  }
});

test('author with upload_media can browse media gallery JSON', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const response = await agent.get('/admin/media/gallery?type=image');
  expect(response.status).toBe(200);
  expect(response.body.items).toEqual(expect.any(Array));
});

test('media gallery settings endpoint returns items', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/settings/media-gallery?type=image');
  expect(response.status).toBe(200);
  expect(response.body.items).toEqual(expect.any(Array));
});

test('editor JSON upload returns image location', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/media');

  const response = await agent
    .post('/admin/media/upload-json')
    .set('x-csrf-token', csrf)
    .attach('file', TEST_IMAGE, { filename: 'editor-upload.png', contentType: 'image/png' });

  expect(response.status).toBe(200);
  expect(response.body.location).toMatch(/^\/uploads\//);
  expect(response.body.filePath).toBe(response.body.location);
  expect(response.body.location).not.toMatch(/\.\./);

  const fs = require('fs');
  const path = require('path');
  const diskPath = path.join(process.cwd(), 'public', response.body.location.replace(/^\//, '').replace(/\//g, path.sep));
  expect(fs.existsSync(diskPath)).toBe(true);

  const gallery = await agent.get('/admin/media/gallery?type=image');
  expect(gallery.body.items.some((item) => item.filePath === response.body.filePath)).toBe(true);
});

test('guest cannot access media library', async () => {
  const response = await request(app).get('/admin/media');
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/login/);
});
