const {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_COOKIE,
  createEngine,
  resolveLocaleFromRequest
} = require('../utils/translationEngine');
const { LOCALES, LOCALE_LABELS, LOCALE_NATIVES } = require('../utils/locales');

function localeMiddleware(req, res, next) {
  const locale = resolveLocaleFromRequest(req);
  const engine = createEngine(locale, { useDatabase: process.env.NODE_ENV !== 'test' });

  res.locals.locale = locale;
  res.locals.defaultLocale = DEFAULT_LOCALE;
  res.locals.supportedLocales = SUPPORTED_LOCALES;
  res.locals.locales = LOCALES;
  res.locals.localeLabels = LOCALE_LABELS;
  res.locals.localeNatives = LOCALE_NATIVES;
  res.locals.localeLabel = LOCALE_LABELS[locale] || LOCALE_LABELS.en;
  res.locals.translationEngine = engine;
  res.locals.translateText = (text) => engine.translate(text);
  res.locals.translateHtml = (html) => engine.translateHtml(html);

  return next();
}

module.exports = { localeMiddleware, LOCALE_COOKIE, LOCALE_LABELS };
