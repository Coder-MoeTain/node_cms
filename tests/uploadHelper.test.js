const fs = require('fs');
const { resolveImageValue, isValidUploadPath, sanitizeUploadPath } = require('../utils/uploadHelper');

const sessionReq = { session: { user: { id: 1 } }, files: {} };

beforeEach(() => {
  jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
    const normalized = String(filePath).replace(/\\/g, '/');
    return /existing\.png|from-body\.png|logo\.png|2026\/06\//.test(normalized);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('resolveImageValue keeps existing path when no upload provided', async () => {
  const record = { featured_image: '/uploads/existing.png' };
  const value = await resolveImageValue(
    { ...sessionReq, body: {} },
    { pathField: 'featured_image', record }
  );
  expect(value).toBe('/uploads/existing.png');
});

test('resolveImageValue returns empty string when no record path exists', async () => {
  const value = await resolveImageValue(
    { ...sessionReq, body: {} },
    { pathField: 'featured_image', record: null }
  );
  expect(value).toBe('');
});

test('resolveImageValue honors remove flag and body override', async () => {
  const removed = await resolveImageValue(
    { ...sessionReq, body: { remove_logo: '1' } },
    { pathField: 'logo', record: { logo: '/uploads/existing.png' } }
  );
  expect(removed).toBe('');

  const fromBody = await resolveImageValue(
    { ...sessionReq, body: { logo: '/uploads/from-body.png' } },
    { pathField: 'logo', record: { logo: '/uploads/existing.png' } }
  );
  expect(fromBody).toBe('/uploads/from-body.png');
});

test('resolveImageValue reads SiteSetting value column', async () => {
  const value = await resolveImageValue(
    { ...sessionReq, body: { site_logo: '' } },
    { pathField: 'site_logo', record: { key: 'site_logo', value: '/uploads/logo.png' } }
  );
  expect(value).toBe('/uploads/logo.png');
});

test('resolveImageValue rejects missing upload paths from body', async () => {
  const value = await resolveImageValue(
    { ...sessionReq, body: { site_logo: '/uploads/photo-pool/missing.jpg' } },
    { pathField: 'site_logo', record: { key: 'site_logo', value: '/uploads/logo.png' } }
  );
  expect(value).toBe('/uploads/logo.png');
});

test('sanitizeUploadPath allows external URLs', () => {
  expect(isValidUploadPath('https://cdn.example.com/logo.png')).toBe(true);
  expect(sanitizeUploadPath('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
});

test('sanitizeUploadPath rejects missing local files', () => {
  expect(sanitizeUploadPath('/uploads/photo-pool/test-logo.jpg')).toBe('');
});
