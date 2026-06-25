const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.code === 'EBADCSRFTOKEN' ? 403 : error.status || 500;
  logger.error('request_error', {
    message: error.message,
    stack: error.stack,
    status,
    code: error.code,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  if (req.originalUrl.includes('/upload-json') || req.originalUrl.startsWith('/api')) {
    return res.status(status).json({
      error: error.code === 'EBADCSRFTOKEN'
        ? 'Your session token expired or was invalid. Please reload the page and try again.'
        : error.message || 'Server error'
    });
  }

  return res.status(status).render('errors/500', {
    title: status === 403 ? 'Forbidden' : 'Server Error',
    message: error.code === 'EBADCSRFTOKEN'
      ? 'Your session token expired or was invalid. Please reload the form and try again.'
      : process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong.'
  });
}

module.exports = errorHandler;
