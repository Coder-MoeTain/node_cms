const { User, Media, Category, Tag } = require('../models');
const { siteScopeWhere } = require('./siteScope');

async function buildEmbedded(req, record, embedParam) {
  const embed = String(embedParam || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!embed.length || !record) return null;

  const embedded = {};

  if (embed.includes('author') && record.author_id) {
    const author = await User.findByPk(record.author_id, {
      attributes: ['id', 'name', 'email', 'profile_image']
    });
    if (author) embedded.author = author;
  }

  const wantsFeatured = embed.includes('wp:featuredmedia') || embed.includes('featured_media');
  if (wantsFeatured && record.featured_image) {
    const media = await Media.findOne({
      where: siteScopeWhere(req, { file_path: record.featured_image })
    });
    if (media) embedded['wp:featuredmedia'] = media;
  }

  if (embed.includes('wp:term') || embed.includes('terms')) {
    if (record.Category) embedded['wp:term'] = [record.Category];
    if (record.Tags?.length) {
      embedded['wp:term'] = (embedded['wp:term'] || []).concat(record.Tags);
    }
    if (record.taxonomyTerms?.length) {
      embedded['wp:term'] = (embedded['wp:term'] || []).concat(record.taxonomyTerms);
    }
  }

  if (embed.includes('wp:featuredmedia') && !embedded['wp:featuredmedia'] && record.category_id) {
    const category = record.Category || await Category.findByPk(record.category_id);
    if (category) embedded.category = category;
  }

  return Object.keys(embedded).length ? embedded : null;
}

function attachEmbed(res, embedded) {
  if (!embedded) return res;
  return { ...res, _embedded: embedded };
}

module.exports = { buildEmbedded, attachEmbed };
