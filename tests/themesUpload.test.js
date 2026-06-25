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

async function restoreDefaultTheme() {
  await models.Theme.update({ active: false }, { where: {} });
  await models.ThemeSetting.update({ active: false }, { where: {} });
  await models.ThemeSetting.update({ active: true }, { where: { theme_name: 'classic-blog' } });
  const classic = await models.Theme.findOne({ where: { slug: 'classic-blog' } });
  if (classic) await classic.update({ active: true });
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
  await restoreDefaultTheme();
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
    .post(`/admin/themes/upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .attach('archive', zipPath);
  expect(response.status).toBe(302);
  const row = await models.Theme.findOne({ where: { slug: UPLOAD_SLUG } });
  expect(row).toBeTruthy();
});

test('admin can upload parent and child themes, activate child, then uninstall both', async () => {
  const parentZip = path.join(os.tmpdir(), `${PARENT_SLUG}-lifecycle-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(PARENT_SLUG), parentZip);
  const childZip = path.join(os.tmpdir(), `${CHILD_SLUG}-lifecycle-${Date.now()}.zip`);
  createZipArchive(themeTemplateFiles(CHILD_SLUG, { parent: PARENT_SLUG, name: 'Zip Child Theme' }), childZip);

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  let csrf = await getCsrf(agent, '/admin/themes');

  const parentUpload = await agent
    .post(`/admin/themes/upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .attach('archive', parentZip);
  expect(parentUpload.status).toBe(302);

  csrf = await getCsrf(agent, '/admin/themes');
  const childUpload = await agent
    .post(`/admin/themes/upload?_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .attach('archive', childZip);
  expect(childUpload.status).toBe(302);

  const childRow = await models.Theme.findOne({ where: { slug: CHILD_SLUG } });
  expect(childRow).toBeTruthy();

  csrf = await getCsrf(agent, '/admin/themes');
  const activate = await agent
    .post('/admin/themes/activate')
    .type('form')
    .send({ _csrf: csrf, theme_id: childRow.id });
  expect(activate.status).toBe(302);
  await childRow.reload();
  expect(childRow.active).toBe(true);

  const activeSetting = await models.ThemeSetting.findOne({ where: { theme_name: CHILD_SLUG, active: true } });
  expect(activeSetting).toBeTruthy();

  await models.Theme.update({ active: false }, { where: { slug: CHILD_SLUG } });
  csrf = await getCsrf(agent, '/admin/themes');
  const uninstallChild = await agent.post(`/admin/themes/${CHILD_SLUG}/uninstall`).type('form').send({ _csrf: csrf });
  expect(uninstallChild.status).toBe(302);
  expect(await models.Theme.findOne({ where: { slug: CHILD_SLUG } })).toBeNull();

  csrf = await getCsrf(agent, '/admin/themes');
  const uninstallParent = await agent.post(`/admin/themes/${PARENT_SLUG}/uninstall`).type('form').send({ _csrf: csrf });
  expect(uninstallParent.status).toBe(302);
  expect(await models.Theme.findOne({ where: { slug: PARENT_SLUG } })).toBeNull();
});
