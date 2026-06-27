const { SlugRedirect } = require('../models');

async function recordSlugChange(resourceType, resourceId, oldSlug, newSlug, transaction = null) {
  const previous = String(oldSlug || '').trim();
  const next = String(newSlug || '').trim();
  if (!previous || !next || previous === next) return;

  await SlugRedirect.findOrCreate({
    where: { resource_type: resourceType, old_slug: previous },
    defaults: { resource_type: resourceType, resource_id: resourceId, old_slug: previous },
    transaction
  });

  await SlugRedirect.update(
    { resource_id: resourceId },
    { where: { resource_type: resourceType, old_slug: previous }, transaction }
  );
}

async function resolveSlugRedirect(resourceType, slug) {
  const row = await SlugRedirect.findOne({
    where: { resource_type: resourceType, old_slug: slug }
  });
  if (!row) return null;

  const { Post, Page } = require('../models');
  const model = resourceType === 'page' ? Page : Post;
  const record = await model.findByPk(row.resource_id, { paranoid: false });
  if (!record || record.deleted_at) return null;

  const prefix = resourceType === 'page' ? '/page/' : '/post/';
  return { url: `${prefix}${record.slug}`, status: 301 };
}

module.exports = { recordSlugChange, resolveSlugRedirect };
