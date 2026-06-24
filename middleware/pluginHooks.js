const pluginLoader = require('../utils/pluginLoader');

async function pluginHooks(req, res, next) {
  try {
    const redirect = await pluginLoader.applyHook('requestRedirect', null, { req, res });
    if (redirect) {
      const target = typeof redirect === 'string' ? redirect : redirect.url;
      const status = typeof redirect === 'object' && redirect.status ? redirect.status : 301;
      if (target) return res.redirect(status, target);
    }

    const cacheControl = await pluginLoader.applyHook('cacheControl', null, { req, res });
    if (cacheControl) res.set('Cache-Control', cacheControl);

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = pluginHooks;
