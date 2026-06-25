const {
  SUPPORTED_LOCALES,
  normalizeLocale,
  translatePlainText,
  translateHtmlSegment
} = require('./translationEngine');

const TRANSLATION_FIELDS = ['title', 'excerpt', 'content', 'seo_title', 'seo_description'];
const HTML_FIELDS = new Set(['content']);

function translateField(text, field, sourceLocale, targetLocale) {
  if (!text) return '';
  if (sourceLocale === targetLocale) return text;
  return HTML_FIELDS.has(field)
    ? translateHtmlSegment(text, sourceLocale, targetLocale)
    : translatePlainText(text, sourceLocale, targetLocale);
}

async function translateContentFields(fields = {}, sourceLocale = 'en') {
  const source = normalizeLocale(sourceLocale);
  const input = {};
  for (const field of TRANSLATION_FIELDS) {
    input[field] = fields[field] == null ? '' : String(fields[field]);
  }

  const translations = {};
  for (const locale of SUPPORTED_LOCALES) {
    const target = normalizeLocale(locale);
    translations[target] = {};
    for (const field of TRANSLATION_FIELDS) {
      translations[target][field] = translateField(input[field], field, source, target);
    }
  }
  return translations;
}

module.exports = {
  TRANSLATION_FIELDS,
  translateContentFields
};
