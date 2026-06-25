const { TranslationEngine } = require('../utils/translationEngine');
const { translatePost } = require('../utils/contentTranslator');
const { saveTranslations, loadTranslation } = require('../utils/contentTranslationStore');
const { ContentTranslation, Post } = require('../models');

describe('content translations', () => {
  test('manual post translation overrides glossary', async () => {
    const post = await Post.create({
      title: 'Hello World',
      slug: 'hello-world-tr-test',
      content: '<p>English body text.</p>',
      status: 'published',
      post_type: 'post'
    });

    await ContentTranslation.create({
      resource_type: 'post',
      resource_id: post.id,
      locale: 'my',
      title: 'မင်္ဂလာပါ',
      content: '<p>မြန်မာဘာသာ အကြောင်းအရာ။</p>'
    });

    const engine = new TranslationEngine({ targetLocale: 'my', useDatabase: false });
    const translated = await translatePost(engine, post, 'post');
    expect(translated.title).toBe('မင်္ဂလာပါ');
    expect(translated.content).toContain('မြန်မာဘာသာ');

    await post.destroy();
    await ContentTranslation.destroy({ where: { resource_type: 'post', resource_id: post.id } });
  });

  test('saveTranslations persists locale fields from form body', async () => {
    const post = await Post.create({
      title: 'Save Test',
      slug: 'save-tr-test',
      content: '<p>Test</p>',
      status: 'draft',
      post_type: 'post'
    });

    await saveTranslations('post', post.id, {
      tr: {
        my: { title: 'ခေါင်းစဉ်', content: '<p>အကြောင်းအရာ</p>' },
        ru: { title: 'Заголовок' }
      }
    });

    const myRow = await loadTranslation('post', post.id, 'my');
    expect(myRow.title).toBe('ခေါင်းစဉ်');
    expect(myRow.content).toContain('အကြောင်းအရာ');

    const ruRow = await loadTranslation('post', post.id, 'ru');
    expect(ruRow.title).toBe('Заголовок');

    await post.destroy();
    await ContentTranslation.destroy({ where: { resource_type: 'post', resource_id: post.id } });
  });
});
