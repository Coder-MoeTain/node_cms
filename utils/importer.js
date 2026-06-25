const sanitizeHtml = require('sanitize-html');
const models = require('../models');

const MAX_IMPORT_RECORDS = 5000;
const ALLOWED_ROOT_KEYS = new Set([
  'posts',
  'pages',
  'custom_posts',
  'categories',
  'tags',
  'menus',
  'widget_areas',
  'exported_at',
  'version'
]);

function stripDangerousKeys(value) {
  if (Array.isArray(value)) return value.map(stripDangerousKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value).reduce((acc, [key, nested]) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return acc;
    acc[key] = stripDangerousKeys(nested);
    return acc;
  }, Array.isArray(value) ? [] : {});
}

function sanitizeImportedHtml(value) {
  if (typeof value !== 'string') return value;
  return sanitizeHtml(value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'iframe']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
      img: ['src', 'alt', 'title', 'width', 'height']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data']
  });
}

function validateImportPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid import file.');
  }

  const unknownKeys = Object.keys(data).filter((key) => !ALLOWED_ROOT_KEYS.has(key));
  if (unknownKeys.length) {
    throw new Error(`Import file contains unsupported keys: ${unknownKeys.join(', ')}`);
  }

  let recordCount = 0;
  for (const key of ALLOWED_ROOT_KEYS) {
    if (!Array.isArray(data[key])) continue;
    recordCount += data[key].length;
    if (recordCount > MAX_IMPORT_RECORDS) {
      throw new Error(`Import file exceeds maximum record count (${MAX_IMPORT_RECORDS}).`);
    }
  }

  return stripDangerousKeys(data);
}

async function previewImport(data) {
  const validated = validateImportPayload(data);
  return {
    posts: (validated.posts || []).length,
    pages: (validated.pages || []).length,
    custom_posts: (validated.custom_posts || []).length,
    categories: (validated.categories || []).length,
    tags: (validated.tags || []).length,
    menus: (validated.menus || []).length,
    widget_areas: (validated.widget_areas || []).length
  };
}

async function importSite(data, { dryRun = false, userId = null } = {}) {
  const validated = validateImportPayload(data);
  const summary = await previewImport(validated);
  const logs = [];

  if (dryRun) {
    return { dryRun: true, summary, logs: ['Dry run only — no records written.'] };
  }

  const job = await models.ImportJob.create({
    job_type: 'json',
    status: 'running',
    created_by: userId,
    summary_json: JSON.stringify(summary)
  });

  try {
    for (const row of validated.categories || []) {
      const { id, ...rest } = row;
      await models.Category.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Category: ${rest.slug}`);
    }
    for (const row of validated.tags || []) {
      const { id, ...rest } = row;
      await models.Tag.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Tag: ${rest.slug}`);
    }
    for (const row of validated.posts || []) {
      const { id, Tags, Category, author, ...rest } = row;
      rest.post_type = rest.post_type || 'post';
      if (rest.content) rest.content = sanitizeImportedHtml(rest.content);
      if (rest.excerpt) rest.excerpt = sanitizeImportedHtml(rest.excerpt);
      await models.Post.findOrCreate({ where: { slug: rest.slug, post_type: 'post' }, defaults: rest });
      logs.push(`Post: ${rest.slug}`);
    }
    for (const row of validated.pages || []) {
      const { id, author, ...rest } = row;
      if (rest.content) rest.content = sanitizeImportedHtml(rest.content);
      await models.Page.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Page: ${rest.slug}`);
    }
    for (const row of validated.menus || []) {
      const { id, items, ...rest } = row;
      const [menu] = await models.Menu.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      for (const item of items || []) {
        const { id: itemId, menu_id, ...itemRest } = item;
        await models.MenuItem.findOrCreate({
          where: { menu_id: menu.id, title: itemRest.title, url: itemRest.url || '' },
          defaults: { ...itemRest, menu_id: menu.id }
        });
      }
      logs.push(`Menu: ${rest.slug}`);
    }
    for (const row of validated.widget_areas || []) {
      const { id, widgets, ...rest } = row;
      const [area] = await models.WidgetArea.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      for (const widget of widgets || []) {
        const { id: widgetId, widget_area_id, ...widgetRest } = widget;
        await models.WidgetInstance.findOrCreate({
          where: { widget_area_id: area.id, widget_type: widgetRest.widget_type, title: widgetRest.title || '' },
          defaults: { ...widgetRest, widget_area_id: area.id }
        });
      }
      logs.push(`Widget area: ${rest.slug}`);
    }

    await job.update({
      status: 'completed',
      log_text: logs.join('\n'),
      summary_json: JSON.stringify(summary)
    });
    return { dryRun: false, summary, logs, jobId: job.id };
  } catch (error) {
    await job.update({ status: 'failed', log_text: `${logs.join('\n')}\n${error.message}` });
    throw error;
  }
}

module.exports = {
  previewImport,
  importSite,
  validateImportPayload,
  sanitizeImportedHtml
};
