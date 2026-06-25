const appConfig = require('../config/app');
const models = require('../models');

async function siteResolver(req, res, next) {
  if (!appConfig.multisiteEnabled) {
    res.locals.currentSite = null;
    return next();
  }
  try {
    const host = req.get('host')?.split(':')[0];
    let site = null;
    if (host) {
      const domain = await models.SiteDomain.findOne({
        where: { domain: host },
        include: [{ model: models.Site, where: { status: 'active' }, required: true }]
      });
      site = domain?.Site || null;
    }
    if (!site) {
      site = await models.Site.findOne({ where: { status: 'active' }, order: [['id', 'ASC']] });
    }
    res.locals.currentSite = site;
    req.currentSite = site;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { siteResolver };
