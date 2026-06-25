const sanitizeHtml = require('sanitize-html');
const { ContentTranslation } = require('../models');
const { SUPPORTED_LOCALES, DEFAULT_LOCALE } = require('./translationEngine');

const TRANSLATION_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const richTextSanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'iframe']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder']
  },
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com']
};

function sanitizePlain(value, max = 5000) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, max);
}

function parseTranslationBody(body) {
  const input = body.tr || body.translations || {};
  const output = {};
  for (const locale of TRANSLATION_LOCALES) {
    const row = input[locale] || input[locale.replace('-', '_')] || {};
    const title = sanitizePlain(row.title, 220);
    const excerpt = sanitizePlain(row.excerpt, 5000);
    const content = row.content
      ? sanitizeHtml(String(row.content), richTextSanitizeOptions)
      : '';
    const seo_title = sanitizePlain(row.seo_title, 220);
    const seo_description = sanitizePlain(row.seo_description, 2000);
    if (title || excerpt || content || seo_title || seo_description) {
      output[locale] = { title, excerpt, content, seo_title, seo_description };
    }
  }
  return output;
}

async function loadTranslations(resourceType, resourceId) {
  if (!resourceId) return {};
  const rows = await ContentTranslation.findAll({
    where: { resource_type: resourceType, resource_id: resourceId }
  });
  return rows.reduce((map, row) => {
    map[row.locale] = row.get({ plain: true });
    return map;
  }, {});
}

async function loadTranslation(resourceType, resourceId, locale) {
  if (!resourceId || !locale) return null;
  const row = await ContentTranslation.findOne({
    where: { resource_type: resourceType, resource_id: resourceId, locale }
  });
  return row ? row.get({ plain: true }) : null;
}

async function saveTranslations(resourceType, resourceId, body, transaction = null) {
  const parsed = parseTranslationBody(body);
  for (const locale of TRANSLATION_LOCALES) {
    const fields = parsed[locale];
    if (!fields) {
      await ContentTranslation.destroy({
        where: { resource_type: resourceType, resource_id: resourceId, locale },
        transaction
      });
      continue;
    }
    const [row] = await ContentTranslation.findOrCreate({
      where: { resource_type: resourceType, resource_id: resourceId, locale },
      defaults: { ...fields },
      transaction
    });
    await row.update(fields, { transaction });
  }
}

function applyManualTranslation(record, manual) {
  if (!manual || !record) return record;
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : { ...record };
  for (const field of ['title', 'excerpt', 'content', 'seo_title', 'seo_description']) {
    if (manual[field]) plain[field] = manual[field];
  }
  if (manual.name) plain.name = manual.name;
  if (manual.description) plain.description = manual.description;
  return plain;
}

module.exports = {
  TRANSLATION_LOCALES,
  parseTranslationBody,
  loadTranslations,
  loadTranslation,
  saveTranslations,
  applyManualTranslation
};
