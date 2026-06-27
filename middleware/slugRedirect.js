const { resolveSlugRedirect } = require('../utils/slugRedirectHelper');

function slugRedirectMiddleware(resourceType) {
  return async (req, res, next) => {
    try {
      const redirect = await resolveSlugRedirect(resourceType, req.params.slug);
      if (redirect) return res.redirect(redirect.status, redirect.url);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { slugRedirectMiddleware };
