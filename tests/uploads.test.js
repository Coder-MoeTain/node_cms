const { isSafeEntryName } = require('../utils/packageArchive');

// Mirror upload middleware rules for unit testing
const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs', '.jar', '.svg', '.html', '.htm']);

function isAllowedUpload(extension, mimetype) {
  const allowedImageMimeTypes = new Map([
    ['image/jpeg', ['.jpg', '.jpeg']],
    ['image/png', ['.png']],
    ['image/gif', ['.gif']],
    ['image/webp', ['.webp']]
  ]);
  const ext = extension.toLowerCase();
  if (blockedExtensions.has(ext)) return false;
  return Boolean(allowedImageMimeTypes.get(mimetype)?.includes(ext));
}

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
