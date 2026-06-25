const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { buildCommentTree, gravatarUrl } = require('../utils/commentHelper');
const { renderBlocks, validateBlockSchema } = require('../utils/blockRenderer');
const { parseShortcodes } = require('../utils/shortcodeParser');
const { exportSite } = require('../utils/exporter');
const { previewImport } = require('../utils/importer');
const { runUpdateCheck } = require('../utils/updateChecker');
const { runChecks } = require('../utils/siteHealth');

describe('WordPress-like features', () => {
  test('comment tree builder nests replies', () => {
    const tree = buildCommentTree([
      { id: 1, parent_id: null, name: 'A', content: 'root' },
      { id: 2, parent_id: 1, name: 'B', content: 'child' }
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].replies).toHaveLength(1);
  });

  test('gravatarUrl returns md5 avatar URL', () => {
    expect(gravatarUrl('test@example.com')).toMatch(/gravatar\.com/);
  });

  test('block schema validation rejects invalid JSON', () => {
    expect(validateBlockSchema('not-json').valid).toBe(false);
    expect(validateBlockSchema([{ type: 'paragraph', content: 'Hi' }]).valid).toBe(true);
  });

  test('renderBlocks escapes script tags', () => {
    const html = renderBlocks([{ type: 'paragraph', content: '<script>x</script>' }]);
    expect(html).not.toMatch(/<script>/);
  });

  test('exportSite returns structured payload', async () => {
    const data = await exportSite({ includeMedia: false });
    expect(data.version).toBe('1.0');
    expect(Array.isArray(data.posts)).toBe(true);
  });

  test('previewImport counts entities', async () => {
    const summary = await previewImport({ posts: [{ slug: 'a' }], pages: [] });
    expect(summary.posts).toBe(1);
  });

  test('update checker runs without error', async () => {
    const report = await runUpdateCheck();
    expect(report.core).toBeTruthy();
  });

  test('site health returns checks', async () => {
    const report = await runChecks();
    expect(Array.isArray(report.checks)).toBe(true);
  });

  test('admin widgets page loads', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/widgets');
    expect(res.status).toBe(200);
  });

  test('admin comments moderation page loads', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/comments?status=pending');
    expect(res.status).toBe(200);
  });

  test('admin tools and updates pages load', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    expect((await agent.get('/admin/tools')).status).toBe(200);
    expect((await agent.get('/admin/updates')).status).toBe(200);
    expect((await agent.get('/admin/templates')).status).toBe(200);
  });

  test('API v1 widgets endpoint', async () => {
    const res = await request(app).get('/api/v1/widgets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
