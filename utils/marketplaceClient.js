const fs = require('fs');
const path = require('path');
const appConfig = require('../config/app');
const { assertSafeOutboundUrlResolved } = require('./ssrfGuard');

const LOCAL_CATALOG = path.join(__dirname, '..', 'data', 'marketplace-catalog.json');

function loadLocalCatalog() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CATALOG, 'utf8'));
  } catch {
    return { plugins: [], themes: [] };
  }
}

async function fetchRemoteCatalog() {
  const url = process.env.MARKETPLACE_CATALOG_URL || appConfig.marketplaceCatalogUrl;
  if (!url) return null;
  await assertSafeOutboundUrlResolved(url, { allowHttp: appConfig.env !== 'production' });
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Marketplace catalog HTTP ${res.status}`);
  return res.json();
}

async function getCatalog() {
  try {
    const remote = await fetchRemoteCatalog();
    if (remote?.plugins || remote?.themes) return remote;
  } catch {
    // fall back to bundled catalog
  }
  return loadLocalCatalog();
}

function filterCatalog(catalog, { type, query } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const match = (item) => !q || `${item.name} ${item.slug} ${item.description || ''}`.toLowerCase().includes(q);
  return {
    plugins: type === 'themes' ? [] : (catalog.plugins || []).filter(match),
    themes: type === 'plugins' ? [] : (catalog.themes || []).filter(match)
  };
}

module.exports = { getCatalog, filterCatalog, loadLocalCatalog };
