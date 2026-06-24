const crypto = require('crypto');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function getSubmittedToken(req) {
  // Multipart uploads are parsed by Multer on the route, so body _csrf is not available
  // when this middleware runs. Pass the token in the query string or a header instead.
  return req.query?._csrf || req.body?._csrf || req.get('csrf-token') || req.get('x-csrf-token');
}

function csrfProtection(req, res, next) {
  req.csrfToken = () => ensureToken(req);
  const token = ensureToken(req);
  if (safeMethods.has(req.method)) return next();

  const submitted = getSubmittedToken(req);
  const submittedBuffer = Buffer.from(String(submitted || ''));
  const tokenBuffer = Buffer.from(String(token));
  const valid = submittedBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(submittedBuffer, tokenBuffer);
  if (!valid) {
    const error = new Error('invalid csrf token');
    error.status = 403;
    error.code = 'EBADCSRFTOKEN';
    return next(error);
  }
  return next();
}

module.exports = { csrfProtection };
