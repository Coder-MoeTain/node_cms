const request = require('supertest');
const { buildPortalConfigBlock, MYANMAR_PORTAL_DEFAULTS } = require('../utils/portalConfig');
const { app, models } = require('../server');

beforeAll(async () => {
  await models.ThemeSetting.update({
    header_layout: 'portal',
    primary_color: '#0b5f8a',
    secondary_color: '#f4b000',
    custom_css: buildPortalConfigBlock(MYANMAR_PORTAL_DEFAULTS)
  }, { where: { active: true } });
});

test('portal home includes portal chrome and section nav', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/portal-header|data-portal-header/);
  expect(response.text).toMatch(/portal-section-nav|portal-quick-services/);
});

test('portal 404 uses public error layout', async () => {
  const response = await request(app).get('/page/does-not-exist-xyz');
  expect(response.status).toBe(404);
  expect(response.text).toMatch(/portal-page|portal-main|Page not found|404/i);
});

test('search includes pagination query support', async () => {
  const response = await request(app).get('/search?q=welcome');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Search/);
});
