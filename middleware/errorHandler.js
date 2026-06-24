function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  console.error(error);

  if (req.originalUrl.startsWith('/api')) {
    return res.status(status).json({ message: error.message || 'Server error' });
  }

  return res.status(status).render('errors/500', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong.'
  });
}

module.exports = errorHandler;
