const request = require('supertest');
const { app, models } = require('../server');
const { ensurePortalTheme } = require('./helpers');

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
  expect(response.text).toMatch(/portal-media|Media Gallery/i);
});

test('portal homepage renders latest news widget', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/latest-news|Latest News/i);
});
