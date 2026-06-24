const {
  translatePlainText,
  normalizeLocale,
  TranslationEngine,
  SUPPORTED_LOCALES
} = require('../utils/translationEngine');

describe('translationEngine', () => {
  test('supports expected locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'my', 'zh-CN', 'ru']);
    expect(normalizeLocale('zh-cn')).toBe('zh-CN');
    expect(normalizeLocale('invalid')).toBe('en');
  });

  test('returns original text for default locale', async () => {
    const engine = new TranslationEngine({ targetLocale: 'en', useDatabase: false });
    await expect(engine.translate('Home')).resolves.toBe('Home');
  });

  test('translates menu labels to Myanmar', () => {
    const translated = translatePlainText('Latest News', 'en', 'my');
    expect(translated).toBe('နောက်ဆုံးသတင်းများ');
  });

  test('translates menu labels to Chinese', () => {
    const translated = translatePlainText('Government Organizations', 'en', 'zh-CN');
    expect(translated).toBe('政府机构');
  });

  test('translates menu labels to Russian', () => {
    const translated = translatePlainText('Public Holidays', 'en', 'ru');
    expect(translated).toBe('Государственные праздники');
  });

  test('translates via engine without database', async () => {
    const engine = new TranslationEngine({ targetLocale: 'my', useDatabase: false });
    await expect(engine.translate('Contact')).resolves.toBe('ဆက်သွယ်ရန်');
  });
});
