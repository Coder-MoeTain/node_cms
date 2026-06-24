const { resolveImageValue } = require('../utils/uploadHelper');

const sessionReq = { session: { user: { id: 1 } }, files: {} };

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
    { pathField: 'logo', record: { logo: '/old.png' } }
  );
  expect(removed).toBe('');

  const fromBody = await resolveImageValue(
    { ...sessionReq, body: { logo: '/uploads/from-body.png' } },
    { pathField: 'logo', record: { logo: '/old.png' } }
  );
  expect(fromBody).toBe('/uploads/from-body.png');
});
