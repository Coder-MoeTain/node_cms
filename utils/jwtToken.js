const crypto = require('crypto');
const appConfig = require('../config/app');

const DEFAULT_TTL_SEC = 3600;
const API_SCOPES = [
  'read',
  'write:posts',
  'write:pages',
  'write:media',
  'write:comments',
  'write:menus',
  'write:widgets',
  'write:settings',
  'admin'
];

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64url(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function signJwt(payload, options = {}) {
  const secret = options.secret || appConfig.jwtSecret;
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iat: now,
    exp: now + (options.expiresInSec || DEFAULT_TTL_SEC),
    ...payload
  };
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(body))
  ];
  const signature = crypto
    .createHmac('sha256', secret)
    .update(segments.join('.'))
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${segments.join('.')}.${signature}`;
}

function verifyJwt(token, options = {}) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = options.secret || appConfig.jwtSecret;
  const [headerB64, payloadB64, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (signature !== expected) return null;
  let payload;
  try {
    payload = JSON.parse(decodeBase64url(payloadB64));
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function normalizeScopes(scopes) {
  if (!scopes) return ['read'];
  if (scopes === 'admin' || scopes === '*') return [...API_SCOPES];
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/[\s,]+/);
  return list.filter((s) => API_SCOPES.includes(s));
}

function hasApiScope(apiUser, required) {
  if (!apiUser) return false;
  if (apiUser.auth === 'api_key') return true;
  const scopes = normalizeScopes(apiUser.scopes);
  if (scopes.includes('admin')) return true;
  if (required === 'read') return scopes.includes('read') || scopes.some((s) => s.startsWith('write:'));
  if (Array.isArray(required)) {
    return required.some((perm) => {
      const map = {
        manage_posts: 'write:posts',
        manage_pages: 'write:pages',
        manage_media: 'write:media',
        upload_media: 'write:media',
        manage_comments: 'write:comments',
        manage_menus: 'write:menus',
        manage_banners: 'write:widgets',
        manage_settings: 'write:settings',
        manage_categories: 'write:posts',
        manage_tags: 'write:posts'
      };
      return scopes.includes(map[perm] || perm);
    });
  }
  return scopes.includes(required);
}

module.exports = {
  API_SCOPES,
  signJwt,
  verifyJwt,
  normalizeScopes,
  hasApiScope
};
