const slugify = require('slugify');

function createSlug(value, fallback = 'item') {
  const source = value && String(value).trim() ? value : `${fallback}-${Date.now()}`;
  return slugify(source, { lower: true, strict: true, trim: true }) || `${fallback}-${Date.now()}`;
}

async function createUniqueSlug(model, value, fallback = 'item', ignoreId = null, scopeWhere = {}) {
  const base = createSlug(value, fallback);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await model.findOne({ where: { slug: candidate, ...scopeWhere }, paranoid: false });
    if (!existing) return candidate;
    if (ignoreId && existing && Number(existing.id) === Number(ignoreId)) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

module.exports = { createSlug, createUniqueSlug };
