const models = require('../models');

async function getNetworkSiteSetting(siteId, key) {
  if (!siteId || !key) return null;
  const row = await models.NetworkSiteSetting.findOne({
    where: { site_id: siteId, setting_key: key }
  });
  return row?.setting_value ?? null;
}

async function setNetworkSiteSetting(siteId, key, value) {
  if (!siteId || !key) {
    throw new Error('Site id and setting key are required.');
  }
  const [row] = await models.NetworkSiteSetting.findOrCreate({
    where: { site_id: siteId, setting_key: key },
    defaults: { setting_value: value }
  });
  if (!row.isNewRecord) {
    await row.update({ setting_value: value });
  }
  return row;
}

async function listNetworkSiteSettings(siteId) {
  if (!siteId) return [];
  return models.NetworkSiteSetting.findAll({
    where: { site_id: siteId },
    order: [['setting_key', 'ASC']]
  });
}

module.exports = {
  getNetworkSiteSetting,
  setNetworkSiteSetting,
  listNetworkSiteSettings
};
