const appConfig = require('../config/app');

const DEFAULT_POST_STRUCTURE = '/post/%slug%';
const DEFAULT_PAGE_STRUCTURE = '/page/%slug%';
const PERMALINK_TOKENS = ['%year%', '%month%', '%day%', '%post_id%', '%postname%', '%slug%', '%type%'];

function normalizeStructure(value, fallback) {
  const raw = String(value || fallback).trim();
  if (!raw.startsWith('/')) return fallback;
  return raw.replace(/\/+/g, '/');
}

function isDefaultStructure(structure, type = 'post') {
  const fallback = type === 'page' ? DEFAULT_PAGE_STRUCTURE : DEFAULT_POST_STRUCTURE;
  return normalizeStructure(structure, fallback) === fallback;
}

async function getPermalinkSettings(SiteSetting) {
  const rows = await SiteSetting.findAll({
    where: { key: ['permalink_structure', 'page_permalink_structure'] }
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    post: normalizeStructure(map.permalink_structure, DEFAULT_POST_STRUCTURE),
    page: normalizeStructure(map.page_permalink_structure, DEFAULT_PAGE_STRUCTURE)
  };
}

function buildPermalink(structure, record, type = 'post') {
  const slug = record.slug || '';
  const date = record.published_at || record.created_at || new Date();
  const d = new Date(date);
  const replacements = {
    '%slug%': slug,
    '%year%': String(d.getFullYear()),
    '%month%': String(d.getMonth() + 1).padStart(2, '0'),
    '%day%': String(d.getDate()).padStart(2, '0'),
    '%postname%': slug,
    '%post_id%': String(record.id || ''),
    '%type%': type
  };
  let path = structure;
  for (const [token, value] of Object.entries(replacements)) {
    path = path.split(token).join(value);
  }
  return path.replace(/\/+/g, '/');
}

function postPath(record, settings) {
  return buildPermalink(settings?.post || DEFAULT_POST_STRUCTURE, record, 'post');
}

function pagePath(record, settings) {
  return buildPermalink(settings?.page || DEFAULT_PAGE_STRUCTURE, record, 'page');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function structureToRegex(structure) {
  const normalized = normalizeStructure(structure, DEFAULT_POST_STRUCTURE);
  const tokenPatterns = {
    '%year%': '(?<year>\\d{4})',
    '%month%': '(?<month>\\d{2})',
    '%day%': '(?<day>\\d{2})',
    '%slug%': '(?<slug>[^/]+)',
    '%postname%': '(?<slug>[^/]+)',
    '%post_id%': '(?<post_id>\\d+)',
    '%type%': '(?<type>[^/]+)'
  };
  let pattern = '^';
  let remaining = normalized;
  while (remaining.length) {
    let tokenIndex = -1;
    let token = '';
    for (const candidate of PERMALINK_TOKENS) {
      const index = remaining.indexOf(candidate);
      if (index >= 0 && (tokenIndex < 0 || index < tokenIndex)) {
        tokenIndex = index;
        token = candidate;
      }
    }
    if (tokenIndex < 0) {
      pattern += escapeRegex(remaining);
      break;
    }
    if (tokenIndex > 0) pattern += escapeRegex(remaining.slice(0, tokenIndex));
    pattern += tokenPatterns[token];
    remaining = remaining.slice(tokenIndex + token.length);
  }
  return new RegExp(`${pattern}/?$`);
}

function matchPermalinkPath(pathname, structure, type = 'post') {
  if (isDefaultStructure(structure, type)) return null;
  const match = structureToRegex(structure).exec(pathname);
  if (!match?.groups?.slug) return null;
  return { type, slug: match.groups.slug };
}

function publicUrl(path) {
  const base = String(appConfig.url || '').replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

module.exports = {
  DEFAULT_POST_STRUCTURE,
  DEFAULT_PAGE_STRUCTURE,
  PERMALINK_TOKENS,
  getPermalinkSettings,
  buildPermalink,
  postPath,
  pagePath,
  matchPermalinkPath,
  isDefaultStructure,
  structureToRegex,
  publicUrl,
  normalizeStructure
};
