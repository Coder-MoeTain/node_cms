const { TranslationEngine } = require('../utils/translationEngine');
const { translatePost } = require('../utils/contentTranslator');
const { saveTranslations, loadTranslation } = require('../utils/contentTranslationStore');
const { ContentTranslation, Post, User } = require('../models');

describe('content translations', () => {
  let authorId;

  beforeAll(async () => {
    const admin = await User.findOne({ where: { email: 'admin@example.com' } });
    authorId = admin?.id || null;
  });

  test('manual post translation overrides glossary for non-English content', async () => {
    const post = await Post.create({
      title: 'မြန်မာခေါင်းစဉ်',
      slug: `myanmar-title-test-${Date.now()}`,
      content: '<p>မြန်မာအကြောင်းအရာ</p>',
      status: 'published',
      post_type: 'post',
      author_id: authorId
    });

    await ContentTranslation.create({
      resource_type: 'post',
      resource_id: post.id,
      locale: 'zh-CN',
      title: '中文标题',
      content: '<p>中文内容</p>'
    });

    const engine = new TranslationEngine({ sourceLocale: 'en', targetLocale: 'zh-CN', useDatabase: false });
    const translated = await translatePost(engine, post, 'post', 'my');
    expect(translated.title).toBe('中文标题');
    expect(translated.content).toContain('中文内容');

    await post.destroy();
    await ContentTranslation.destroy({ where: { resource_type: 'post', resource_id: post.id } });
  });

  test('manual post translation overrides glossary', async () => {
    const post = await Post.create({
      title: 'Hello World',
      slug: `hello-world-tr-test-${Date.now()}`,
      content: '<p>English body text.</p>',
      status: 'published',
      post_type: 'post',
      author_id: authorId
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

  test('manual English translation overrides glossary for English visitors', async () => {
    const slug = `english-tr-test-${Date.now()}`;
    const post = await Post.create({
      title: 'မြန်မာခေါင်းစဉ်',
      slug,
      content: '<p>မြန်မာအကြောင်းအရာ</p>',
      status: 'published',
      post_type: 'post',
      author_id: authorId
    });

    await ContentTranslation.create({
      resource_type: 'post',
      resource_id: post.id,
      locale: 'en',
      title: 'English Title',
      content: '<p>English body text.</p>'
    });

    const engine = new TranslationEngine({ sourceLocale: 'my', targetLocale: 'en', useDatabase: false });
    const translated = await translatePost(engine, post, 'post', 'my');
    expect(translated.title).toBe('English Title');
    expect(translated.content).toContain('English body text');

    await post.destroy();
    await ContentTranslation.destroy({ where: { resource_type: 'post', resource_id: post.id } });
  });

  test('saveTranslations persists locale fields from form body', async () => {
    const post = await Post.create({
      title: 'Save Test',
      slug: `save-tr-test-${Date.now()}`,
      content: '<p>Test</p>',
      status: 'draft',
      post_type: 'post',
      author_id: authorId
    });

    await saveTranslations('post', post.id, {
      tr: {
        en: { title: 'English Title', content: '<p>English content</p>' },
        my: { title: 'ခေါင်းစဉ်', content: '<p>အကြောင်းအရာ</p>' },
        ru: { title: 'Заголовок' }
      }
    });

    const enRow = await loadTranslation('post', post.id, 'en');
    expect(enRow.title).toBe('English Title');
    expect(enRow.content).toContain('English content');

    const myRow = await loadTranslation('post', post.id, 'my');
    expect(myRow.title).toBe('ခေါင်းစဉ်');
    expect(myRow.content).toContain('အကြောင်းအရာ');

    const ruRow = await loadTranslation('post', post.id, 'ru');
    expect(ruRow.title).toBe('Заголовок');

    await post.destroy();
    await ContentTranslation.destroy({ where: { resource_type: 'post', resource_id: post.id } });
  });
});
