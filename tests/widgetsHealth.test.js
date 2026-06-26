const { buildWidgetFromForm, seedDefaultSidebarWidgets, ensureDefaultWidgetAreas, WIDGET_TYPES } = require('../utils/widgetRegistry');
const { renderWidget } = require('../utils/widgetRenderer');
const { runChecks } = require('../utils/siteHealth');
const { models } = require('../server');

describe('widgetRegistry', () => {
  test('buildWidgetFromForm parses recent posts settings', () => {
    const payload = buildWidgetFromForm({
      widget_type: 'recent_posts',
      title: 'Latest',
      limit: '8',
      show_date: 'on'
    }, 'recent_posts');
    expect(payload.widget_type).toBe('recent_posts');
    expect(payload.title).toBe('Latest');
    const settings = JSON.parse(payload.settings_json);
    expect(settings.limit).toBe(8);
    expect(settings.show_date).toBe(true);
  });

  test('WIDGET_TYPES includes core WordPress-like widgets', () => {
    expect(WIDGET_TYPES).toEqual(expect.arrayContaining(['search', 'recent_posts', 'categories', 'custom_html']));
  });
});

describe('widgetRenderer', () => {
  test('renderWidget outputs search form HTML', async () => {
    const html = await renderWidget({
      id: 1,
      widget_type: 'search',
      title: 'Search',
      settings_json: '{}'
    });
    expect(html).toMatch(/action="\/search"/);
    expect(html).toMatch(/Search/);
  });
});

describe('siteHealth report', () => {
  test('runChecks returns grouped checks and score', async () => {
    const report = await runChecks();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.groups.length).toBeGreaterThanOrEqual(3);
    expect(report.checks.some((c) => c.description)).toBe(true);
  });
});

describe('widget seeding', () => {
  test('seedDefaultSidebarWidgets adds defaults when empty', async () => {
    await ensureDefaultWidgetAreas(models);
    const area = await models.WidgetArea.findOne({ where: { slug: 'sidebar' } });
    expect(area).toBeTruthy();
    await models.WidgetInstance.destroy({ where: { widget_area_id: area.id } });
    const result = await seedDefaultSidebarWidgets(models);
    expect(result.seeded).toBe(true);
    const count = await models.WidgetInstance.count({ where: { widget_area_id: area.id } });
    expect(count).toBe(3);
  });
});
