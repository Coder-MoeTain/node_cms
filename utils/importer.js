const models = require('../models');

async function previewImport(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid import file.');
  }
  return {
    posts: (data.posts || []).length,
    pages: (data.pages || []).length,
    custom_posts: (data.custom_posts || []).length,
    categories: (data.categories || []).length,
    tags: (data.tags || []).length,
    menus: (data.menus || []).length,
    widget_areas: (data.widget_areas || []).length
  };
}

async function importSite(data, { dryRun = false, userId = null } = {}) {
  const summary = await previewImport(data);
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
    for (const row of data.categories || []) {
      const { id, ...rest } = row;
      await models.Category.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Category: ${rest.slug}`);
    }
    for (const row of data.tags || []) {
      const { id, ...rest } = row;
      await models.Tag.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Tag: ${rest.slug}`);
    }
    for (const row of data.posts || []) {
      const { id, Tags, Category, author, ...rest } = row;
      rest.post_type = rest.post_type || 'post';
      await models.Post.findOrCreate({ where: { slug: rest.slug, post_type: 'post' }, defaults: rest });
      logs.push(`Post: ${rest.slug}`);
    }
    for (const row of data.pages || []) {
      const { id, author, ...rest } = row;
      await models.Page.findOrCreate({ where: { slug: rest.slug }, defaults: rest });
      logs.push(`Page: ${rest.slug}`);
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

module.exports = { previewImport, importSite };
