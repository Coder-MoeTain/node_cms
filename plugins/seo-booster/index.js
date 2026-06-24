const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enableOg = settingBool(settings.enable_og, true);
    const enableTwitter = settingBool(settings.enable_twitter, true);
    const robotsIndex = settingBool(settings.robots_index, true);
    const enableSchema = settingBool(settings.enable_schema, true);
    const ogSiteName = settingValue(settings, 'og_site_name');
    const twitterHandle = settingValue(settings, 'twitter_handle');

    hooks.register('publicHead', ({ req, res }) => {
      const tags = [];
      const title = res.locals.seo?.title || res.locals.siteSettings?.site_title || res.locals.title || 'NodePress CMS';
      const description = res.locals.seo?.description || res.locals.siteSettings?.site_tagline || '';
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
      const image = res.locals.seo?.image || res.locals.siteSettings?.site_logo || '';
      const siteName = ogSiteName || res.locals.siteSettings?.site_title || title;

      if (robotsIndex) tags.push('<meta name="robots" content="index, follow, max-image-preview:large">');
      else tags.push('<meta name="robots" content="noindex, nofollow">');

      if (enableOg) {
        tags.push('<meta property="og:type" content="website">');
        tags.push(`<meta property="og:title" content="${escapeAttr(title)}">`);
        tags.push(`<meta property="og:description" content="${escapeAttr(description)}">`);
        tags.push(`<meta property="og:url" content="${escapeAttr(url)}">`);
        tags.push(`<meta property="og:site_name" content="${escapeAttr(siteName)}">`);
        if (image) tags.push(`<meta property="og:image" content="${escapeAttr(image)}">`);
      }
      if (enableTwitter) {
        tags.push('<meta name="twitter:card" content="summary_large_image">');
        tags.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
        tags.push(`<meta name="twitter:description" content="${escapeAttr(description)}">`);
        if (twitterHandle) tags.push(`<meta name="twitter:site" content="${escapeAttr(twitterHandle)}">`);
        if (image) tags.push(`<meta name="twitter:image" content="${escapeAttr(image)}">`);
      }
      if (enableSchema && !res.locals.seo?.schema) {
        tags.push(`<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
          url: `${req.protocol}://${req.get('host')}`
        })}</script>`);
      }
      return tags;
    }, 5);

    hooks.register('dashboardWidgets', () => ({
      title: 'SEO Toolkit',
      body: [
        enableOg ? 'Open Graph' : null,
        enableTwitter ? 'Twitter Cards' : null,
        enableSchema ? 'JSON-LD' : null,
        robotsIndex ? 'indexing on' : 'indexing off'
      ].filter(Boolean).join(' · ') || 'All SEO features disabled.'
    }));
  }
};
