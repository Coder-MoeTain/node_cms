const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const themeManager = require('../utils/themeManager');
const themeLoader = require('../utils/themeLoader');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { createZipArchive, themeTemplateFiles } = require('./helpers/zipFixtures');

const PARENT_SLUG = 'zip-parent-theme';
const CHILD_SLUG = 'zip-child-theme';
const UPLOAD_SLUG = 'zip-upload-theme';

async function removeTheme(slug) {
  await models.ThemeSetting.destroy({ where: { theme_name: slug } });
  await models.Theme.destroy({ where: { slug }, force: true });
  themeLoader.removeThemeDirectory(slug);
}

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await removeTheme(PARENT_SLUG);
  await removeTheme(CHILD_SLUG);
  await removeTheme(UPLOAD_SLUG);
});

afterEach(async () => {
  await removeTheme(PARENT_SLUG);
  await removeTheme(CHILD_SLUG);
  await removeTheme(UPLOAD_SLUG);
});

test('installThemeFromArchive installs a valid theme zip', async () => {
  const zipPath = path.join(os.tmpdir(), `${UPLOAD_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(UPLOAD_SLUG), zipPath);
  const manifest = await themeManager.installThemeFromArchive(zipPath);
  expect(manifest.slug).toBe(UPLOAD_SLUG);
  const row = await models.Theme.findOne({ where: { slug: UPLOAD_SLUG } });
  expect(row).toBeTruthy();
  expect(fs.existsSync(path.join(themeLoader.themesRoot, UPLOAD_SLUG, 'theme.json'))).toBe(true);
});

test('child theme requires installed parent theme', async () => {
  const zipPath = path.join(os.tmpdir(), `${CHILD_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(CHILD_SLUG, { parent: 'missing-parent-theme' }), zipPath);
  await expect(themeManager.installThemeFromArchive(zipPath)).rejects.toThrow(/parent/i);
});

test('child theme installs when parent exists and inherits template chain', async () => {
  const parentZip = path.join(os.tmpdir(), `${PARENT_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(PARENT_SLUG), parentZip);
  await themeManager.installThemeFromArchive(parentZip);

  const childZip = path.join(os.tmpdir(), `${CHILD_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(CHILD_SLUG, { parent: PARENT_SLUG, name: 'Zip Child Theme' }), childZip);
  const manifest = await themeManager.installThemeFromArchive(childZip);
  expect(manifest.parent).toBe(PARENT_SLUG);

  const assets = themeLoader.discoverThemeAssets(CHILD_SLUG);
  expect(assets.chain).toEqual(expect.arrayContaining([CHILD_SLUG, PARENT_SLUG]));
  expect(themeLoader.getChildThemeSlugs(PARENT_SLUG)).toContain(CHILD_SLUG);
});

test('parent theme cannot be uninstalled while child themes exist', async () => {
  const parentZip = path.join(os.tmpdir(), `${PARENT_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(PARENT_SLUG), parentZip);
  await themeManager.installThemeFromArchive(parentZip);
  const childZip = path.join(os.tmpdir(), `${CHILD_SLUG}-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(CHILD_SLUG, { parent: PARENT_SLUG }), childZip);
  await themeManager.installThemeFromArchive(childZip);

  await models.Theme.update({ active: false }, { where: { slug: PARENT_SLUG } });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes');
  const response = await agent.post(`/admin/themes/${PARENT_SLUG}/uninstall`).type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const stillThere = await models.Theme.findOne({ where: { slug: PARENT_SLUG } });
  expect(stillThere).toBeTruthy();
});

test('admin can upload a theme zip via HTTP', async () => {
  const zipPath = path.join(os.tmpdir(), `${UPLOAD_SLUG}-http-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(UPLOAD_SLUG, { name: 'HTTP Upload Theme' }), zipPath);
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes');
  const response = await agent
    .post('/admin/themes/upload')
    .set('x-csrf-token', csrf)
    .attach('archive', zipPath);
  expect(response.status).toBe(302);
  const row = await models.Theme.findOne({ where: { slug: UPLOAD_SLUG } });
  expect(row).toBeTruthy();
});
