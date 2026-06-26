const { SiteSetting } = require('../../models');
const { listGalleryItems } = require('./mediaController');
const { ensurePortalSettings, SETTING_GROUP_LABELS, SETTING_GROUP_ORDER, PORTAL_SETTING_DEFINITIONS, getSettingGroup } = require('../../utils/portalSettings');
const { resolveImageValue, sanitizeUploadPath } = require('../../utils/uploadHelper');
const { getTimezoneOptions, isValidTimezone } = require('../../utils/timezoneHelper');

async function settings(req, res, next) {
  try {
    await ensurePortalSettings(SiteSetting);
    const rows = await SiteSetting.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });
    for (const row of rows) {
      if (['site_logo', 'favicon'].includes(row.key) && row.value) {
        const valid = sanitizeUploadPath(row.value);
        if (valid !== row.value) {
          await row.update({ value: valid });
          row.value = valid;
        }
      }
    }
    const grouped = {};
    rows.forEach((row) => {
      const group = row.group || getSettingGroup(row.key);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(row);
    });
    return res.render('admin/settings/index', {
      title: 'Site Settings',
      rows,
      grouped,
      groupLabels: SETTING_GROUP_LABELS,
      groupOrder: SETTING_GROUP_ORDER,
      settingDefinitions: PORTAL_SETTING_DEFINITIONS,
      timezoneOptions: getTimezoneOptions()
    });
  } catch (error) {
    return next(error);
  }
}

const brandingImageFields = {
  site_logo: 'site_logo_file',
  favicon: 'favicon_file'
};

async function updateSettings(req, res, next) {
  try {
    for (const [key, fileField] of Object.entries(brandingImageFields)) {
      const existing = await SiteSetting.findOne({ where: { key } });
      const finalValue = await resolveImageValue(req, {
        fileField,
        pathField: key,
        record: existing
      });
      await SiteSetting.upsert({
        key,
        value: finalValue,
        group: getSettingGroup(key)
      });
    }

    for (const [key, value] of Object.entries(req.body)) {
      if (key === '_csrf' || key === '_method' || key.endsWith('_file') || key.startsWith('remove_')) continue;
      if (brandingImageFields[key]) continue;

      let finalValue = Array.isArray(value) ? value.join(',') : value;
      if (key === 'site_timezone' && !isValidTimezone(finalValue)) {
        req.flash('error', 'Invalid timezone selected.');
        continue;
      }
      await SiteSetting.upsert({
        key,
        value: finalValue,
        group: getSettingGroup(key)
      });
    }
    req.flash('success', 'Settings updated.');
    return res.redirect('/admin/settings');
  } catch (error) {
    return next(error);
  }
}

async function mediaGallery(req, res, next) {
  try {
    return res.json(await listGalleryItems(req));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  settings,
  updateSettings,
  mediaGallery
};
