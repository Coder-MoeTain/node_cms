const { Op } = require('sequelize');
const appConfig = require('../config/app');

const SITE_SCOPED_MODELS = new Set([
  'Post', 'Page', 'Category', 'Menu', 'Media', 'Tag', 'WidgetArea', 'WidgetInstance',
  'CustomPostType', 'Taxonomy', 'TaxonomyTerm', 'Comment', 'FieldGroup', 'Banner', 'Slider', 'SiteSetting'
]);

function getCurrentSiteId(req) {
  if (!appConfig.multisiteEnabled) return null;
  return req?.currentSite?.id || req?.res?.locals?.currentSite?.id || null;
}

function isMultisiteActive(req) {
  return Boolean(appConfig.multisiteEnabled && getCurrentSiteId(req));
}

function siteScopeWhere(req, baseWhere = {}) {
  const siteId = getCurrentSiteId(req);
  if (!siteId) return baseWhere;
  return {
    [Op.and]: [
      baseWhere,
      { [Op.or]: [{ site_id: null }, { site_id: siteId }] }
    ]
  };
}

function siteScopeStrictWhere(req, baseWhere = {}) {
  const siteId = getCurrentSiteId(req);
  if (!siteId) return baseWhere;
  return { ...baseWhere, site_id: siteId };
}

function assignSiteScope(req, payload = {}) {
  const siteId = getCurrentSiteId(req);
  if (!siteId) return payload;
  return { ...payload, site_id: siteId };
}

function isSiteScopedModel(model) {
  return Boolean(model?.name && SITE_SCOPED_MODELS.has(model.name));
}

module.exports = {
  SITE_SCOPED_MODELS,
  getCurrentSiteId,
  isMultisiteActive,
  siteScopeWhere,
  siteScopeStrictWhere,
  assignSiteScope,
  isSiteScopedModel
};
