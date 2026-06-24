const appConfig = require('../config/app');

function meta(title, description = '', image = '') {
  return {
    title: title ? `${title} | ${appConfig.name}` : appConfig.name,
    description: description || 'NodePress CMS powered website',
    image,
    canonical: appConfig.url
  };
}

function postSchema(post, url) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seo_description || post.excerpt,
    image: post.og_image || post.featured_image,
    author: { '@type': 'Person', name: post.author?.name || 'NodePress Author' },
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: url
  });
}

module.exports = { meta, postSchema };
