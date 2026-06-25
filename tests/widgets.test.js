const request = require('supertest');
const { app, models } = require('../server');
const { ensurePortalTheme, writeTestUpload } = require('./helpers');

const PORTAL_CONFIG = {
  preset: 'myanmar-portal',
  header: { layout: 'portal' },
  homepage: {
    hero: false,
    quickLinks: true,
    quickServices: true,
    emergency: true,
    latestNews: true,
    mediaGallery: true,
    hotNews: true
  }
};

beforeEach(async () => {
  await ensurePortalTheme(models, PORTAL_CONFIG);
  writeTestUpload('/uploads/widget-gallery-test.jpg');
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  await models.Media.findOrCreate({
    where: { original_name: 'widget-gallery-test.jpg' },
    defaults: {
      original_name: 'widget-gallery-test.jpg',
      filename: 'widget-gallery-test.jpg',
      file_path: '/uploads/widget-gallery-test.jpg',
      file_type: 'image',
      mime_type: 'image/jpeg',
      file_size: 1024,
      uploaded_by: admin?.id || 1
    }
  });
});

test('portal homepage renders quick services widget', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/portal-quick-services|Quick Services/i);
});

test('portal homepage renders emergency contacts widget', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/portal-emergency|Emergency/i);
});

test('portal homepage renders media gallery widget', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/portal-media|Photos &amp; Videos|Photos & Videos/i);
});

test('portal homepage renders latest news widget', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/latest-news|Latest News/i);
});
