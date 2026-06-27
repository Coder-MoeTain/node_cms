const themeLoader = require('./themeLoader');
const { attachFseLocals } = require('./fsePublicHelper');

function isPortalLayout(res) {
  return res.locals.portalConfig?.header?.layout === 'portal'
    || res.locals.activeTheme?.header_layout === 'portal'
    || res.locals.themePreset === 'myanmar-portal';
}

async function renderPublicError(res, locals = {}) {
  const status = Number(locals.code) || 404;
  const themeSlug = res.locals.activeTheme?.theme_name || res.locals.activeTheme?.slug;
  const baseLocals = {
    title: locals.title || 'Page Not Found',
    code: status,
    message: locals.message || 'The page you requested could not be found.',
    isPortal: typeof locals.isPortal === 'boolean' ? locals.isPortal : isPortalLayout(res),
    seo: locals.seo
  };
  const enriched = await attachFseLocals('error', baseLocals, themeSlug, {});
  const template = await themeLoader.resolveTemplate('error', {});
  return res.status(status).render(template, enriched);
}

module.exports = { renderPublicError, isPortalLayout };
