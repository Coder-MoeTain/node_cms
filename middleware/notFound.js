const { renderPublicError } = require('../utils/publicErrorRender');

function notFoundMiddleware(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  return renderPublicError(res, {
    title: 'Page Not Found',
    code: 404,
    message: 'The page you requested could not be found.'
  }).catch(next);
}

module.exports = notFoundMiddleware;
