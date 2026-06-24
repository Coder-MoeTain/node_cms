function notFoundMiddleware(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  const isPortal = res.locals.portalConfig?.header?.layout === 'portal'
    || res.locals.activeTheme?.header_layout === 'portal'
    || res.locals.themePreset === 'myanmar-portal';
  if (isPortal) {
    return res.status(404).render('public/error', {
      title: 'Page Not Found',
      code: 404,
      message: 'The page you requested could not be found.'
    });
  }
  return res.status(404).render('errors/404', { title: 'Page Not Found' });
}

module.exports = notFoundMiddleware;
