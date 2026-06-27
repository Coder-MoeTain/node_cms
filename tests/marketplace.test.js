const { loadLocalCatalog, filterCatalog } = require('../utils/marketplaceClient');

describe('marketplace catalog', () => {
  test('loadLocalCatalog returns bundled plugins and themes', () => {
    const catalog = loadLocalCatalog();
    expect(catalog.plugins.length).toBeGreaterThan(0);
    expect(catalog.themes.length).toBeGreaterThan(0);
  });

  test('filterCatalog searches by query', () => {
    const catalog = loadLocalCatalog();
    const filtered = filterCatalog(catalog, { query: 'seo' });
    expect(filtered.plugins.some((p) => p.slug === 'seo-booster')).toBe(true);
  });
});
