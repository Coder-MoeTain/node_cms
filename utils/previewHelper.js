const crypto = require('crypto');
const appConfig = require('../config/app');

function signPreviewToken(resourceType, resourceId) {
  const payload = `${resourceType}:${resourceId}`;
  const sig = crypto.createHmac('sha256', appConfig.sessionSecret).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${resourceId}:${sig}`).toString('base64url');
}

function verifyPreviewToken(resourceType, resourceId, token) {
  if (!token || !resourceId) return false;
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon < 1) return false;
    const id = decoded.slice(0, colon);
    const sig = decoded.slice(colon + 1);
    if (Number(id) !== Number(resourceId)) return false;
    const expected = crypto
      .createHmac('sha256', appConfig.sessionSecret)
      .update(`${resourceType}:${resourceId}`)
      .digest('hex')
      .slice(0, 32);
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function buildPreviewUrl(resourceType, slug, resourceId) {
  const base = resourceType === 'page' ? `/page/${slug}` : `/post/${slug}`;
  const token = signPreviewToken(resourceType, resourceId);
  return `${base}?preview=${encodeURIComponent(token)}`;
}

function canPreviewContent(req, resourceType, record) {
  if (!record?.id) return false;
  const token = req.query?.preview;
  if (token && verifyPreviewToken(resourceType, record.id, token)) return true;
  const user = req.session?.user;
  if (!user) return false;
  const policy = require('./policy');
  if (resourceType === 'post') return policy.canEditPost(user, record);
  if (resourceType === 'page') return policy.canEditPage(user, record);
  return policy.canAccessAdmin(user, '/admin');
}

module.exports = {
  signPreviewToken,
  verifyPreviewToken,
  buildPreviewUrl,
  canPreviewContent
};
