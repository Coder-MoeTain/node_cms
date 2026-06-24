const slugify = require('slugify');

function createSlug(value, fallback = 'item') {
  const source = value && String(value).trim() ? value : `${fallback}-${Date.now()}`;
  return slugify(source, { lower: true, strict: true, trim: true });
}

module.exports = { createSlug };
