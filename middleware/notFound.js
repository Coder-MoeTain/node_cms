function notFoundMiddleware(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  return res.status(404).render('errors/404', { title: 'Page Not Found' });
}

module.exports = notFoundMiddleware;
