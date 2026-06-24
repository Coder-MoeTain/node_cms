const { isSafeEntryName, MAX_UNCOMPRESSED_BYTES } = require('../utils/packageArchive');
const {
  isAllowedUpload,
  hasUnsafeFileName,
  blockedExtensions
} = require('../middleware/upload');

test('package archive rejects path traversal', () => {
  expect(isSafeEntryName('../evil.php')).toBe(false);
  expect(isSafeEntryName('plugin/../hack.php')).toBe(false);
  expect(isSafeEntryName('plugin/plugin.json')).toBe(true);
});

test('blocked executable extensions are rejected', () => {
  expect(isAllowedUpload('.exe', 'application/octet-stream')).toBe(false);
  expect(isAllowedUpload('.php', 'application/x-php')).toBe(false);
  expect(isAllowedUpload('.js', 'application/javascript')).toBe(false);
});

test('allowed image types pass validation', () => {
  expect(isAllowedUpload('.png', 'image/png')).toBe(true);
  expect(isAllowedUpload('.jpg', 'image/jpeg')).toBe(true);
  expect(isAllowedUpload('.png', 'image/jpeg')).toBe(false);
});

test('unsafe file names are blocked', () => {
  expect(hasUnsafeFileName('../secret.png')).toBe(true);
  expect(hasUnsafeFileName('.env')).toBe(true);
  expect(hasUnsafeFileName('photo.png')).toBe(false);
});

test('blocked extension set includes script types', () => {
  expect(blockedExtensions.has('.php')).toBe(true);
  expect(blockedExtensions.has('.svg')).toBe(true);
});

test('zip bomb limit constant is defined', () => {
  expect(MAX_UNCOMPRESSED_BYTES).toBeGreaterThan(MAX_UNCOMPRESSED_BYTES / 2);
});
