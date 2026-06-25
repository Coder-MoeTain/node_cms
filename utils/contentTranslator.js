const { loadTranslation, loadTranslationsBatch, applyManualTranslation } = require('./contentTranslationStore');
const { createEngine } = require('./translationEngine');

function asPlain(value) {
  if (!value) return value;
  return typeof value.get === 'function' ? value.get({ plain: true }) : { ...value };
}

function resolveContentEngine(engine, contentLocale) {
  if (!engine) return null;
  if (!contentLocale || contentLocale === engine.sourceLocale) return engine;
  return createEngine(engine.targetLocale, {
    sourceLocale: contentLocale,
    useDatabase: engine.useDatabase
  });
}

async function translateFields(engine, record, fields, { htmlFields = [] } = {}) {
  if (!engine?.isActive || !record) return record;
  const plain = asPlain(record);
  const htmlSet = new Set(htmlFields);

  await Promise.all(
    fields.map(async (field) => {
      if (!plain[field]) return;
      plain[field] = htmlSet.has(field)
        ? await engine.translateHtml(plain[field])
        : await engine.translate(plain[field]);
    })
  );

  return plain;
}

async function translateWithManual(engine, record, resourceType, fields, options = {}) {
  if (!record) return record;
  const plain = asPlain(record);
  const contentEngine = resolveContentEngine(engine, options.contentLocale);
  if (!contentEngine?.isActive) return plain;

  const manual = options.manualMap?.get(plain.id) || await loadTranslation(resourceType, plain.id, contentEngine.targetLocale);
  const htmlSet = new Set(options.htmlFields || []);

  await Promise.all(
    fields.map(async (field) => {
      if (manual?.[field]) {
        plain[field] = manual[field];
        return;
      }
      if (!plain[field]) return;
      plain[field] = htmlSet.has(field)
        ? await contentEngine.translateHtml(plain[field])
        : await contentEngine.translate(plain[field]);
    })
  );

  return plain;
}

async function translateMenuTree(engine, items = []) {
  if (!engine?.isActive || !items.length) return items;
  return Promise.all(
    items.map(async (item) => {
      const plain = asPlain(item);
      plain.title = await engine.translate(plain.title);
      if (plain.children?.length) {
        plain.children = await translateMenuTree(engine, plain.children);
      }
      return plain;
    })
  );
}

async function translateMenus(engine, menus = {}) {
  if (!engine?.isActive) return menus;
  const translated = {};
  await Promise.all(
    Object.entries(menus).map(async ([location, items]) => {
      translated[location] = await translateMenuTree(engine, items);
    })
  );
  return translated;
}

async function translatePost(engine, post, resourceType = 'post', contentLocale = null) {
  if (!post) return post;
  const postFields = ['title', 'excerpt', 'content', 'seo_title', 'seo_description'];
  const fieldOptions = { htmlFields: ['content', 'seo_description'], contentLocale };
  const translated = await translateWithManual(engine, post, resourceType, postFields, fieldOptions);
  if (translated.Category) {
    translated.Category = await translateCategory(engine, translated.Category);
  }
  if (translated.category) {
    translated.category = await translateCategory(engine, translated.category);
  }
  if (translated.Tags?.length) {
    translated.Tags = await translateTags(engine, translated.Tags);
  }
  if (translated.tags?.length) {
    translated.tags = await translateTags(engine, translated.tags);
  }
  return translated;
}

async function translatePosts(engine, posts = [], resourceType = 'post', contentLocale = null) {
  if (!posts.length) return posts;
  const contentEngine = resolveContentEngine(engine, contentLocale);
  if (!contentEngine?.isActive) return posts.map((post) => asPlain(post));

  const ids = posts.map((post) => asPlain(post).id).filter(Boolean);
  const manualMap = await loadTranslationsBatch(resourceType, ids, contentEngine.targetLocale);
  const postFields = ['title', 'excerpt', 'content', 'seo_title', 'seo_description'];
  const fieldOptions = { htmlFields: ['content', 'seo_description'], contentLocale, manualMap };

  return Promise.all(
    posts.map(async (post) => {
      const translated = await translateWithManual(engine, post, resourceType, postFields, fieldOptions);
      if (translated.Category) translated.Category = await translateCategory(engine, translated.Category);
      if (translated.category) translated.category = await translateCategory(engine, translated.category);
      if (translated.Tags?.length) translated.Tags = await translateTags(engine, translated.Tags);
      if (translated.tags?.length) translated.tags = await translateTags(engine, translated.tags);
      return translated;
    })
  );
}

async function translatePage(engine, page, contentLocale = null) {
  return translateWithManual(engine, page, 'page', ['title', 'excerpt', 'content', 'seo_title', 'seo_description'], {
    htmlFields: ['content', 'seo_description'],
    contentLocale
  });
}

async function translatePages(engine, pages = [], contentLocale = null) {
  if (!pages.length) return pages;
  const contentEngine = resolveContentEngine(engine, contentLocale);
  if (!contentEngine?.isActive) return pages.map((page) => asPlain(page));
  return Promise.all(pages.map((page) => translatePage(engine, page, contentLocale)));
}

async function translateCategory(engine, category) {
  return translateWithManual(engine, category, 'category', ['name', 'description']);
}

async function translateCategories(engine, categories = []) {
  if (!engine?.isActive || !categories.length) return categories;
  return Promise.all(categories.map((category) => translateCategory(engine, category)));
}

async function translateTag(engine, tag) {
  return translateWithManual(engine, tag, 'tag', ['name', 'description']);
}

async function translateTags(engine, tags = []) {
  if (!engine?.isActive || !tags.length) return tags;
  return Promise.all(tags.map((tag) => translateTag(engine, tag)));
}

async function translateBanner(engine, banner) {
  return translateFields(engine, banner, ['title', 'subtitle', 'button_text']);
}

async function translateBanners(engine, banners = []) {
  if (!engine?.isActive || !banners.length) return banners;
  return Promise.all(banners.map((banner) => translateBanner(engine, banner)));
}

async function translateSlider(engine, slider) {
  return translateFields(engine, slider, ['title', 'description', 'button_text']);
}

async function translateSliders(engine, sliders = []) {
  if (!engine?.isActive || !sliders.length) return sliders;
  return Promise.all(sliders.map((slider) => translateSlider(engine, slider)));
}

async function translateSiteSettings(engine, settings = {}) {
  if (!engine?.isActive || !settings) return settings;
  const keys = ['site_title', 'site_tagline'];
  const translated = { ...settings };
  await Promise.all(
    keys.map(async (key) => {
      if (translated[key]) translated[key] = await engine.translate(translated[key]);
    })
  );
  return translated;
}

module.exports = {
  translateMenuTree,
  translateMenus,
  translatePost,
  translatePosts,
  translatePage,
  translatePages,
  translateCategory,
  translateCategories,
  translateTag,
  translateTags,
  translateBanner,
  translateBanners,
  translateSlider,
  translateSliders,
  translateSiteSettings
};
