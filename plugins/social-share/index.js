const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

const NETWORKS = {
  facebook: { label: 'Facebook', build: (url, title) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  twitter: { label: 'X', build: (url, title, via) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}${via ? `&via=${encodeURIComponent(via.replace('@', ''))}` : ''}` },
  linkedin: { label: 'LinkedIn', build: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  email: { label: 'Email', build: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
  telegram: { label: 'Telegram', build: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enabled = settingBool(settings.enabled, true);
    const showLabels = settingBool(settings.show_labels, true);
    const position = settingValue(settings, 'position', 'footer');
    const buttonStyle = settingValue(settings, 'button_style', 'pill');
    const twitterVia = settingValue(settings, 'twitter_via');
    const networks = settingValue(settings, 'networks', 'facebook,twitter,linkedin,email')
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter((n) => NETWORKS[n]);

    hooks.register('publicFooter', ({ req, res }) => {
      if (!enabled || !req.path.startsWith('/post/')) return null;
      const title = res.locals.seo?.title || res.locals.title || 'Share this post';
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const links = networks.map((key) => {
        const net = NETWORKS[key];
        const href = net.build(url, title, twitterVia);
        const label = showLabels ? escapeHtml(net.label) : '';
        return `<a class="np-share-btn np-share-${key} np-share-style-${buttonStyle}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Share on ${escapeHtml(net.label)}">${label || escapeHtml(net.label.charAt(0))}</a>`;
      }).join('');
      const positionClass = position === 'floating' ? 'np-social-share-floating' : 'np-social-share-inline';
      return `<div class="np-social-share ${positionClass} np-share-style-${buttonStyle}" role="navigation" aria-label="Share this post"><span class="np-share-label">Share:</span>${links}</div><style>.np-social-share{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:1.5rem 0;padding:1rem;background:var(--site-card,#f8f9fa);border-radius:.5rem}.np-social-share-floating{position:sticky;bottom:1rem;z-index:5}.np-share-label{font-weight:600;margin-right:.25rem}.np-share-btn{padding:.35rem .75rem;background:var(--site-button,#0d6efd);color:#fff;font-size:.875rem;text-decoration:none}.np-share-style-pill .np-share-btn{border-radius:999px}.np-share-style-square .np-share-btn{border-radius:.25rem}.np-share-style-minimal .np-share-btn{background:transparent;color:var(--site-button,#0d6efd);padding:0 .5rem 0 0}.np-share-btn:hover{opacity:.9;color:#fff}</style>`;
    });
  }
};
