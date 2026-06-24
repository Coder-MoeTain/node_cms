const fs = require('fs');
const path = require('path');
const os = require('os');
const { ensureDirectory, publicUploadPath, classifyMime } = require('../utils/fileHelper');
const { createSlug, createUniqueSlug } = require('../utils/slugGenerator');
const { mediaUrl, diskPathFromPublic } = require('../utils/mediaHelper');
const { isSafeEntryName } = require('../utils/packageArchive');
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

test('consentScript defers tracking HTML', () => {
  expect(buildDeferredLoader('')).toBe('');
  expect(buildDeferredLoader('<script></script>')).toContain('np-deferred-tracking');
});

test('portalSettings maps keys to groups', () => {
  expect(getSettingGroup('site_title')).toBe('general');
  expect(getSettingGroup('site_tagline')).toBe('portal');
});
