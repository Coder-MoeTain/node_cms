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
  const hadCdn = Object.prototype.hasOwnProperty.call(process.env, 'CDN_URL');
  const original = process.env.CDN_URL;
  process.env.CDN_URL = 'https://cdn.example.com';
  expect(mediaUrl('/uploads/test.png')).toBe('https://cdn.example.com/uploads/test.png');
  if (hadCdn) process.env.CDN_URL = original;
  else delete process.env.CDN_URL;
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

test('shortcodeParser renders allowed shortcodes safely', () => {
  const { parseShortcodes, parseAttributes } = require('../utils/shortcodeParser');
  expect(parseShortcodes('[unknown]')).toBe('[unknown]');
  expect(parseShortcodes(null)).toBe('');
  expect(parseAttributes('label="Go" url="https://example.com"')).toEqual({
    label: 'Go',
    url: 'https://example.com'
  });
  const button = parseShortcodes('[button url="https://example.com" label="Go"]');
  expect(button).toContain('btn btn-primary');
  expect(button).toContain('Go');
  const recent = parseShortcodes('[recent_posts limit="2"]', {
    recentPosts: [{ slug: 'a', title: 'Post A' }, { slug: 'b', title: 'Post B' }, { slug: 'c', title: 'Post C' }]
  });
  expect(recent).toContain('Post A');
  expect(recent).not.toContain('Post C');
  expect(parseShortcodes('[subscribe]')).toContain('np-shortcode-subscribe');
  expect(parseShortcodes('[gallery]inner[/gallery]')).toContain('np-shortcode-gallery');
});

test('pageHelper loadChildPages returns published children ordered by menu_order', async () => {
  const { loadChildPages } = require('../utils/pageHelper');
  const { models } = require('../server');
  const parent = await models.Page.create({
    title: 'Parent For Children',
    slug: `parent-children-${Date.now()}`,
    content: '<p>P</p>',
    status: 'published',
    published_at: new Date()
  });
  const childB = await models.Page.create({
    title: 'Child B',
    slug: `child-b-${Date.now()}`,
    content: '<p>B</p>',
    status: 'published',
    parent_id: parent.id,
    menu_order: 2,
    published_at: new Date()
  });
  await models.Page.create({
    title: 'Child Draft',
    slug: `child-draft-${Date.now()}`,
    content: '<p>D</p>',
    status: 'draft',
    parent_id: parent.id,
    menu_order: 1,
    published_at: null
  });
  const childA = await models.Page.create({
    title: 'Child A',
    slug: `child-a-${Date.now()}`,
    content: '<p>A</p>',
    status: 'published',
    parent_id: parent.id,
    menu_order: 1,
    published_at: new Date()
  });
  const children = await loadChildPages(parent.id);
  expect(children.map((row) => row.id)).toEqual([childA.id, childB.id]);
});

test('blockRenderer renders block types and validates schema', () => {
  const { renderBlock, renderBlocks, validateBlockSchema } = require('../utils/blockRenderer');
  expect(renderBlock(null)).toBe('');
  expect(renderBlock({ type: 'heading', content: 'Title', attrs: { level: 9 } })).toBe('<h6>Title</h6>');
  expect(renderBlock({ type: 'image', attrs: { src: '/img.png', alt: 'A' } })).toContain('np-block-image');
  expect(renderBlock({ type: 'image', attrs: {} })).toBe('');
  expect(renderBlock({ type: 'quote', content: 'Q', attrs: { cite: 'Author' } })).toContain('<cite>Author</cite>');
  expect(renderBlock({ type: 'button', attrs: { url: '/go', label: 'Go' } })).toContain('btn-primary');
  expect(renderBlock({ type: 'list', items: ['a', 'b'], attrs: { ordered: true } })).toMatch(/<ol>/);
  expect(renderBlock({ type: 'list', items: ['a'] })).toMatch(/<ul>/);
  expect(renderBlock({ type: 'html', content: '<p>safe</p><script>x</script>' })).not.toMatch(/<script>/);
  expect(renderBlock({ type: 'spacer', attrs: { height: 48 } })).toContain('48px');
  expect(renderBlock({ type: 'custom', content: 'x' })).toContain('np-block-custom');
  expect(renderBlocks('not-json')).toBe('');
  expect(renderBlocks({ bad: true })).toBe('');
  expect(renderBlocks(JSON.stringify([{ type: 'paragraph', content: 'Hi' }]))).toContain('<p>Hi</p>');
  expect(validateBlockSchema([{ content: 'no type' }]).valid).toBe(false);
  expect(validateBlockSchema([{ type: 1 }]).valid).toBe(false);
});

test('vendorAssets resolves vendor directory from public or node_modules', () => {
  const fs = require('fs');
  const path = require('path');
  const { resolveVendorDir } = require('../utils/vendorAssets');
  const bootstrap = resolveVendorDir('bootstrap', 'dist/css');
  expect(fs.existsSync(bootstrap)).toBe(true);
  const missing = resolveVendorDir('definitely-not-a-real-vendor-package-xyz');
  expect(missing).toContain(path.join('public', 'vendor'));
});

test('importer validates payload shape and strips prototype pollution keys', async () => {
  const { validateImportPayload, previewImport, sanitizeImportedHtml } = require('../utils/importer');
  expect(() => validateImportPayload(null)).toThrow(/Invalid import file/);
  expect(() => validateImportPayload({ unsupported: [] })).toThrow(/unsupported keys/);
  const cleaned = validateImportPayload({
    posts: [{ title: 'A', slug: 'a' }],
    pages: []
  });
  expect(cleaned.posts).toHaveLength(1);
  expect(await previewImport({ posts: [{ slug: 'a' }], pages: [{ slug: 'b' }] })).toMatchObject({
    posts: 1,
    pages: 1
  });
  expect(sanitizeImportedHtml('<p>ok</p><script>x</script>')).not.toMatch(/<script>/);
  const huge = { posts: new Array(5001).fill({ slug: 'x' }) };
  expect(() => validateImportPayload(huge)).toThrow(/maximum record count/);
});

test('themeValidator enforces manifest rules and screenshot safety', () => {
  const fs = require('fs');
  const path = require('path');
  const { validateManifest, validateScreenshotPath } = require('../utils/themeValidator');
  const themesRoot = path.join(process.cwd(), 'themes');

  expect(() => validateManifest(null)).toThrow(/JSON object/);
  expect(() => validateManifest({ name: 'X', slug: 'Bad_Slug', version: '1.0.0' })).toThrow(/kebab-case/);
  expect(() => validateManifest({
    name: 'Loop',
    slug: 'loop-theme',
    version: '1.0.0',
    parent: 'loop-theme'
  })).toThrow(/own parent/);
  expect(() => validateManifest({
    name: 'Bad Settings',
    slug: 'bad-settings',
    version: '1.0.0',
    settings: []
  })).toThrow(/settings.*object/);

  const manifest = validateManifest({
    name: 'Default',
    slug: 'default',
    version: '1.0.0',
    settings: { colors: { primary: '#000' } }
  }, { themesRoot, strict: false });
  expect(manifest._normalizedSettings.colors.primary).toBe('#000');

  expect(() => validateScreenshotPath({ screenshot: '../evil.png' }, themesRoot)).toThrow(/not safe/);
  const defaultTheme = path.join(themesRoot, 'default');
  if (fs.existsSync(defaultTheme)) {
    expect(() => validateScreenshotPath({ screenshot: 'missing.png' }, defaultTheme)).toThrow(/not found/);
  }
});

test('widgetRegistry builds form payloads and parses stored settings', () => {
  const { buildWidgetFromForm, settingsToFormValues } = require('../utils/widgetRegistry');
  const built = buildWidgetFromForm({
    title: 'Recent',
    limit: '99',
    show_date: 'on',
    status: 'active'
  }, 'recent_posts');
  expect(built.widget_type).toBe('recent_posts');
  expect(JSON.parse(built.settings_json).limit).toBeLessThanOrEqual(20);
  const invalid = settingsToFormValues({
    title: 'X',
    status: 'active',
    settings_json: 'not-json'
  });
  expect(invalid.title).toBe('X');
  const parsed = settingsToFormValues({
    title: 'Y',
    settings_json: JSON.stringify({ limit: 3, show_date: false, dropdown: true })
  });
  expect(parsed.show_date).toBe(false);
  expect(parsed.dropdown).toBe(true);
});

test('widgetRegistry stores non-number menu slug fields', () => {
  const { buildWidgetFromForm } = require('../utils/widgetRegistry');
  const built = buildWidgetFromForm({
    title: 'Footer Links',
    menu_slug: ' footer-menu '
  }, 'navigation_menu');
  expect(JSON.parse(built.settings_json).menu_slug).toBe('footer-menu');
});

test('sliderHelper parses JSON image strings and empty slider records', () => {
  const { expandSlidersToSlides, getSliderImageAt } = require('../utils/sliderHelper');
  expect(getSliderImageAt({ images: '["/a.jpg","/b.jpg"]' }, 2)).toBe('/b.jpg');
  expect(getSliderImageAt({ images: 'broken-json' }, 1)).toBe('');
  expect(expandSlidersToSlides([{ title: 'Empty' }])).toEqual([{ title: 'Empty', image: null }]);
});

test('autosaveHelper returns null when stored JSON is invalid', async () => {
  const { saveAutosave, loadAutosave } = require('../utils/autosaveHelper');
  const { models } = require('../server');
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const post = await models.Post.create({
    title: 'Autosave Invalid JSON',
    slug: `autosave-invalid-${Date.now()}`,
    content: '<p>x</p>',
    status: 'draft',
    post_type: 'post',
    author_id: admin.id
  });
  await saveAutosave('post', post.id, { title: 'Draft' }, admin.id);
  await models.Autosave.update(
    { draft_data_json: 'not-json' },
    { where: { resource_type: 'post', resource_id: post.id, created_by: admin.id } }
  );
  expect(await loadAutosave('post', post.id, admin.id)).toBeNull();
});

test('autosaveHelper deleteAutosave removes stored drafts', async () => {
  const { saveAutosave, loadAutosave, deleteAutosave } = require('../utils/autosaveHelper');
  const { models } = require('../server');
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const post = await models.Post.create({
    title: 'Autosave Delete',
    slug: `autosave-delete-${Date.now()}`,
    content: '<p>x</p>',
    status: 'draft',
    post_type: 'post',
    author_id: admin.id
  });
  await saveAutosave('post', post.id, { title: 'Draft' }, admin.id);
  await deleteAutosave('post', post.id, admin.id);
  expect(await loadAutosave('post', post.id, admin.id)).toBeNull();
});

test('locales flagCodeForLocale falls back to en for unknown codes', () => {
  const { flagCodeForLocale } = require('../utils/locales');
  expect(flagCodeForLocale('zh-CN')).toBe('zh');
  expect(flagCodeForLocale('unknown-locale')).toBe('en');
});

test('contentPasswordHelper hashes, verifies, and builds SEO meta', async () => {
  const {
    hashContentPassword,
    verifyContentPassword,
    isContentUnlocked,
    buildSeoMeta
  } = require('../utils/contentPasswordHelper');
  expect(await hashContentPassword('')).toBeNull();
  expect(await hashContentPassword('  ')).toBeNull();
  const hash = await hashContentPassword('secret');
  expect(await verifyContentPassword('secret', hash)).toBe(true);
  expect(await verifyContentPassword('', hash)).toBe(false);
  expect(isContentUnlocked({ cookies: {} }, 'post', 1, null)).toBe(true);
  const seo = buildSeoMeta({
    title: 'T',
    slug: 't',
    seo_title: 'SEO',
    robots_noindex: true
  }, { pathPrefix: '/post/' });
  expect(seo.noindex).toBe(true);
  expect(seo.canonical).toContain('/post/t');
});
