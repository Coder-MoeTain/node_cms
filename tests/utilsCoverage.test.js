const fs = require('fs');
const path = require('path');
const os = require('os');
const { ensureDirectory, publicUploadPath, classifyMime } = require('../utils/fileHelper');
const { createSlug, createUniqueSlug } = require('../utils/slugGenerator');
const { mediaUrl, diskPathFromPublic, normalizeUploadUrlsInHtml, resolvePublicMediaUrl } = require('../utils/mediaHelper');
const { isSafeEntryName, extractZipArchive } = require('../utils/packageArchive');
const { resolveThemePartials, partialIncludePath } = require('../utils/themePartials');
const { getPagination, pageMeta } = require('../utils/pagination');
const { buildDeferredLoader } = require('../utils/consentScript');
const { getSettingGroup } = require('../utils/portalSettings');

test('fileHelper creates directories and classifies mime types', () => {
  const tempDir = path.join(os.tmpdir(), `nodepress-test-${Date.now()}`);
  ensureDirectory(tempDir);
  expect(fs.existsSync(tempDir)).toBe(true);
  fs.rmSync(tempDir, { recursive: true, force: true });

  expect(classifyMime('image/png')).toBe('image');
  expect(classifyMime('video/mp4')).toBe('video');
  expect(classifyMime('application/pdf')).toBe('document');
  expect(classifyMime('text/plain')).toBe('other');
  expect(publicUploadPath('2026/06/file.png')).toContain('uploads');
});

test('slugGenerator creates unique slugs', async () => {
  const mockModel = {
    findOne: jest.fn()
      .mockResolvedValueOnce({ id: 1, slug: 'hello' })
      .mockResolvedValueOnce(null)
  };
  expect(createSlug('Hello World')).toBe('hello-world');
  const slug = await createUniqueSlug(mockModel, 'Hello', 'post');
  expect(slug).toBe('hello-2');
});

test('mediaHelper builds CDN URLs and disk paths', () => {
  const original = process.env.CDN_URL;
  process.env.CDN_URL = 'https://cdn.example.com';
  expect(mediaUrl('/uploads/test.png')).toBe('https://cdn.example.com/uploads/test.png');
  process.env.CDN_URL = original;
  expect(diskPathFromPublic('/uploads/test.png')).toContain('uploads');
});

test('resolvePublicMediaUrl hides missing local uploads and keeps valid CDN paths', () => {
  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'resolve-media-test');
  fs.mkdirSync(uploadRoot, { recursive: true });
  const filePath = path.join(uploadRoot, 'exists.png');
  fs.writeFileSync(filePath, 'x');

  expect(resolvePublicMediaUrl('/uploads/resolve-media-test/exists.png')).toBe('/uploads/resolve-media-test/exists.png');
  expect(resolvePublicMediaUrl('https://www.example.gov.mm/uploads/resolve-media-test/exists.png')).toBe('/uploads/resolve-media-test/exists.png');
  expect(resolvePublicMediaUrl('/uploads/resolve-media-test/missing.png')).toBe('');
  expect(resolvePublicMediaUrl('https://www.example.gov.mm/uploads/resolve-media-test/missing.png')).toBe('');

  fs.rmSync(uploadRoot, { recursive: true, force: true });
});

test('mediaHelper normalizes relative upload URLs in HTML', () => {
  const html = '<p><img src="uploads/2026/06/test.png" alt="x"></p>';
  expect(normalizeUploadUrlsInHtml(html)).toBe('<p><img src="/uploads/2026/06/test.png" alt="x"></p>');
  expect(normalizeUploadUrlsInHtml('<img src="/admin/uploads/a.png">')).toBe('<img src="/uploads/a.png">');
  expect(normalizeUploadUrlsInHtml('<img src="/uploads/ok.png">')).toBe('<img src="/uploads/ok.png">');
});

test('pagination helpers compute page metadata', () => {
  const req = { query: { page: '2', limit: '10' } };
  const paging = getPagination(req, 10, 100);
  expect(paging.page).toBe(2);
  expect(paging.offset).toBe(10);
  expect(pageMeta(45, 2, 10).pages).toBe(5);
});

test('packageArchive rejects unsafe entry names', () => {
  expect(isSafeEntryName('theme/theme.json')).toBe(true);
  expect(isSafeEntryName('../evil.php')).toBe(false);
});

test('packageArchive extracts a valid plugin zip archive', async () => {
  const { createZipArchive, pluginFixtureFiles } = require('./helpers/zipFixtures');
  const targetRoot = path.join(os.tmpdir(), `archive-extract-${Date.now()}`);
  const zipPath = path.join(targetRoot, 'plugin.zip');
  fs.mkdirSync(targetRoot, { recursive: true });
  createZipArchive(pluginFixtureFiles('extract-test-plugin'), zipPath);

  const { manifest } = await extractZipArchive(zipPath, targetRoot, 'plugin.json');
  expect(manifest.slug).toBe('extract-test-plugin');
  expect(fs.existsSync(path.join(targetRoot, 'extract-test-plugin', 'plugin.json'))).toBe(true);

  fs.rmSync(targetRoot, { recursive: true, force: true });
});

test('themePartials resolve public partial paths', async () => {
  const map = await resolveThemePartials();
  expect(map.head).toBeTruthy();
  expect(partialIncludePath(map, 'head')).toBe(map.head);
  expect(partialIncludePath(null, 'footer')).toBe('public/partials/footer');
});

test('consentScript defers tracking HTML', () => {
  expect(buildDeferredLoader('')).toBe('');
  expect(buildDeferredLoader('<script></script>')).toContain('np-deferred-tracking');
});

test('portalSettings maps keys to groups', () => {
  expect(getSettingGroup('site_title')).toBe('general');
  expect(getSettingGroup('site_tagline')).toBe('portal');
});

test('testDatabase isolates test DB name from production DB', () => {
  const { resolveIsolatedTestDatabaseName } = require('../utils/testDatabase');
  expect(resolveIsolatedTestDatabaseName({ DB_NAME: 'nodepress_cms', TEST_DB_NAME: 'nodepress_cms' }))
    .toBe('nodepress_cms_test');
  expect(resolveIsolatedTestDatabaseName({ DB_NAME: 'nodepress_cms', TEST_DB_NAME: 'nodepress_cms_test' }))
    .toBe('nodepress_cms_test');
});

test('previewHelper signs and verifies preview tokens', () => {
  const { signPreviewToken, verifyPreviewToken, buildPreviewUrl } = require('../utils/previewHelper');
  const token = signPreviewToken('post', 42);
  expect(verifyPreviewToken('post', 42, token)).toBe(true);
  expect(verifyPreviewToken('post', 43, token)).toBe(false);
  expect(verifyPreviewToken('page', 42, token)).toBe(false);
  expect(buildPreviewUrl('post', 'hello-world', 42)).toMatch(/^\/post\/hello-world\?preview=/);
});

test('resolveBestMediaUrl falls back when thumbnail is missing', () => {
  const { resolveBestMediaUrl } = require('../utils/mediaHelper');
  expect(resolveBestMediaUrl('/uploads/missing-thumb.webp', '/uploads/missing-all.webp')).toBe('');
});
