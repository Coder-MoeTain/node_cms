const { SiteSetting } = require('../../models');
const policy = require('../../utils/policy');
const { normalizeLocale } = require('../../utils/translationEngine');
const { translateContentFields, TRANSLATION_FIELDS } = require('../../utils/contentAutoTranslator');

async function resolveSourceLocale(body = {}) {
  if (body.source_locale) return normalizeLocale(body.source_locale);
  const row = await SiteSetting.findOne({ where: { key: 'default_content_locale' } });
  return normalizeLocale(row?.value || process.env.DEFAULT_CONTENT_LOCALE || 'en');
}

function canTranslateContent(user) {
  return policy.hasAnyPermission(user, [
    'manage_posts',
    'manage_pages',
    'manage_custom_content',
    'create_posts',
    'edit_posts'
  ]);
}

async function translateContent(req, res, next) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!canTranslateContent(req.session.user)) {
      return res.status(403).json({ error: 'You do not have permission to translate content.' });
    }

    const sourceLocale = await resolveSourceLocale(req.body || {});
    const payload = req.body?.fields || req.body || {};
    const fields = {};
    for (const field of TRANSLATION_FIELDS) {
      fields[field] = payload[field] == null ? '' : String(payload[field]);
    }

    if (!fields.title.trim() && !fields.content.trim() && !fields.excerpt.trim()) {
      return res.status(400).json({ error: 'Add a title or content before translating.' });
    }

    const translations = await translateContentFields(fields, sourceLocale);
    return res.json({ ok: true, source_locale: sourceLocale, translations });
  } catch (error) {
    return next(error);
  }
}

module.exports = { translateContent, canTranslateContent, resolveSourceLocale };
