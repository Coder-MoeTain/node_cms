const LOCALES = [
  { code: 'en', label: 'English', native: 'English', flag: 'en' },
  { code: 'my', label: 'Burmese', native: 'မြန်မာ', flag: 'my' },
  { code: 'zh-CN', label: 'Chinese', native: '中文', flag: 'zh' },
  { code: 'ru', label: 'Russian', native: 'Русский', flag: 'ru' }
];

const LOCALE_LABELS = Object.fromEntries(LOCALES.map((item) => [item.code, item.label]));
const LOCALE_NATIVES = Object.fromEntries(LOCALES.map((item) => [item.code, item.native]));
const FLAG_BY_LOCALE = Object.fromEntries(LOCALES.map((item) => [item.code, item.flag]));

function flagCodeForLocale(locale) {
  return FLAG_BY_LOCALE[locale] || 'en';
}

module.exports = {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_NATIVES,
  flagCodeForLocale
};
