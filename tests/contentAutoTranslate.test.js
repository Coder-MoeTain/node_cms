const { translateContentFields } = require('../utils/contentAutoTranslator');

describe('contentAutoTranslator', () => {
  test('returns all locales with same text when source matches target', async () => {
    const translations = await translateContentFields({
      title: 'Hello',
      content: '<p>Welcome</p>'
    }, 'en');

    expect(translations.en.title).toBe('Hello');
    expect(translations.en.content).toBe('<p>Welcome</p>');
    expect(translations.my.title).toBeTruthy();
    expect(translations['zh-CN'].title).toBeTruthy();
    expect(translations.ru.title).toBeTruthy();
  });

  test('translates English title using glossary', async () => {
    const translations = await translateContentFields({
      title: 'Public Holidays',
      excerpt: '',
      content: '',
      seo_title: '',
      seo_description: ''
    }, 'en');

    expect(translations.my.title).toContain('ပိတ်');
    expect(translations['zh-CN'].title).toContain('假期');
    expect(translations.ru.title).toContain('праздник');
    expect(translations.en.title).toBe('Public Holidays');
  });

  test('translates Myanmar source into distinct locales', async () => {
    const translations = await translateContentFields({
      title: 'အများပြည်သူရုံးပိတ်ရက်များ',
      excerpt: '',
      content: '',
      seo_title: '',
      seo_description: ''
    }, 'my');

    expect(translations.my.title).toBe('အများပြည်သူရုံးပိတ်ရက်များ');
    expect(translations.en.title).toBe('Public Holidays');
    expect(translations['zh-CN'].title).toBe('公共假期');
    expect(translations.ru.title).toBe('Государственные праздники');
  });
});
