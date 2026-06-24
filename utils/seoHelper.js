const appConfig = require('../config/app');

function meta(title, description = '', image = '', opts = {}) {
  const siteName = opts.siteName || appConfig.name;
  const canonical = opts.canonical || appConfig.url;
  return {
    title: title ? `${title} | ${siteName}` : siteName,
    description: description || opts.defaultDescription || 'NodePress CMS powered website',
    image,
    canonical,
    siteName
  };
}

function websiteSchema(siteSettings = {}, siteUrl = appConfig.url) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteSettings.site_title || appConfig.name,
    description: siteSettings.site_tagline || '',
    url: siteUrl,
    publisher: {
      '@type': 'GovernmentOrganization',
      name: siteSettings.site_title || appConfig.name,
      address: siteSettings.contact_address || siteSettings.site_location || undefined
    }
  });
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

module.exports = { meta, postSchema, websiteSchema };
