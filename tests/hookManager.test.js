const hookManager = require('../utils/hookManager');

beforeEach(() => {
  hookManager.clear();
});

test('addFilter and applyFilters chain values', async () => {
  hookManager.addFilter('demo-filter', (value) => ({ ...value, a: 1 }), 10);
  hookManager.addFilter('demo-filter', (value) => ({ ...value, b: 2 }), 20);
  const result = await hookManager.applyFilters('demo-filter', {}, {});
  expect(result).toEqual({ a: 1, b: 2 });
});

test('applyFilters stops when handler returns false', async () => {
  hookManager.addFilter('block-filter', () => false, 10);
  const result = await hookManager.applyFilters('block-filter', { ok: true }, {});
  expect(result).toBe(false);
});

test('addAction and doAction run side effects', async () => {
  const calls = [];
  hookManager.addAction('demo-action', (payload) => { calls.push(payload.id); }, 10);
  await hookManager.doAction('demo-action', { id: 42 }, {});
  expect(calls).toEqual([42]);
});

test('collect merges plugin outputs', async () => {
  hookManager.addAction('publicHead', () => '<meta name="a">', 10);
  hookManager.addAction('publicHead', () => '<meta name="b">', 20);
  const tags = await hookManager.collect('publicHead', {});
  expect(tags.length).toBe(2);
});

test('beforeCommentSave aliases beforeCommentCreate', async () => {
  hookManager.addFilter('beforeCommentCreate', (comment) => {
    if ((comment.content || '').includes('spam')) return null;
    return comment;
  }, 10);
  const blocked = await hookManager.applyFilters('beforeCommentSave', { content: 'spam offer' }, {});
  const allowed = await hookManager.applyFilters('beforeCommentSave', { content: 'Thanks!' }, {});
  expect(blocked).toBeNull();
  expect(allowed.content).toBe('Thanks!');
});

test('createPluginApi exposes WordPress-style helpers', () => {
  const api = hookManager.createPluginApi('demo-plugin');
  expect(typeof api.register).toBe('function');
  expect(typeof api.addFilter).toBe('function');
  expect(typeof api.addAction).toBe('function');
  expect(typeof api.applyFilters).toBe('function');
  expect(typeof api.doAction).toBe('function');
});
