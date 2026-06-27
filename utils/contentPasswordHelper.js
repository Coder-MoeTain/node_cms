const bcrypt = require('bcrypt');
const crypto = require('crypto');

const COOKIE_PREFIX = 'np_content_unlock_';

function cookieName(resourceType, resourceId) {
  return `${COOKIE_PREFIX}${resourceType}_${resourceId}`;
}

async function hashContentPassword(password) {
  if (!password || !String(password).trim()) return null;
  return bcrypt.hash(String(password).trim(), 12);
}

async function verifyContentPassword(password, hash) {
  if (!hash) return true;
  if (!password) return false;
  return bcrypt.compare(String(password), hash);
}

function unlockToken(resourceType, resourceId, passwordHash) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
    .update(`${resourceType}:${resourceId}:${passwordHash}`)
    .digest('hex');
}

function isContentUnlocked(req, resourceType, resourceId, passwordHash) {
  if (!passwordHash) return true;
  const expected = unlockToken(resourceType, resourceId, passwordHash);
  return req.cookies?.[cookieName(resourceType, resourceId)] === expected;
}

function setContentUnlockCookie(res, resourceType, resourceId, passwordHash) {
  const token = unlockToken(resourceType, resourceId, passwordHash);
  res.cookie(cookieName(resourceType, resourceId), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function buildSeoMeta(record, defaults = {}) {
  const appConfig = require('../config/app');
  const baseUrl = defaults.baseUrl || appConfig.url;
  const pathPrefix = defaults.pathPrefix || '';
  const canonical = record.canonical_url || `${baseUrl}${pathPrefix}${record.slug}`;

  return {
    title: record.seo_title || record.title,
    description: record.seo_description || record.excerpt || defaults.defaultDescription || '',
    image: record.og_image || record.featured_image || '',
    canonical,
    ogTitle: record.og_title || record.seo_title || record.title,
    ogDescription: record.og_description || record.seo_description || record.excerpt || '',
    robots: [
      record.robots_noindex ? 'noindex' : 'index',
      record.robots_nofollow ? 'nofollow' : 'follow'
    ].join(', '),
    noindex: Boolean(record.robots_noindex),
    nofollow: Boolean(record.robots_nofollow),
    sitemapInclude: record.sitemap_include !== false
  };
}

module.exports = {
  hashContentPassword,
  verifyContentPassword,
  isContentUnlocked,
  setContentUnlockCookie,
  buildSeoMeta,
  cookieName
};
