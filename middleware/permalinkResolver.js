const { SiteSetting } = require('../models');
const { getPermalinkSettings, matchPermalinkPath } = require('../utils/permalinkHelper');
const site = require('../controllers/public/siteController');

const SKIP_PREFIXES = ['/admin', '/api', '/uploads', '/themes', '/plugins', '/health', '/vendor'];

async function permalinkResolver(req, res, next) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return next();
    if (SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();
    if (['/blog', '/contact', '/search', '/sitemap.xml', '/robots.txt'].includes(req.path)) return next();
    if (req.path.startsWith('/types/') || req.path.startsWith('/category/') || req.path.startsWith('/tag/')) return next();
    if (req.path.startsWith('/taxonomy/')) return next();

    const settings = res.locals.permalinkSettings || await getPermalinkSettings(SiteSetting);
    res.locals.permalinkSettings = settings;

    const pageMatch = matchPermalinkPath(req.path, settings.page, 'page');
    if (pageMatch) {
      req.params = { ...req.params, slug: pageMatch.slug };
      return site.page(req, res, next);
    }

    const postMatch = matchPermalinkPath(req.path, settings.post, 'post');
    if (postMatch) {
      req.params = { ...req.params, slug: postMatch.slug };
      return site.post(req, res, next);
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { permalinkResolver };
