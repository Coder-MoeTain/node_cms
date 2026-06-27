const sanitizeHtml = require('sanitize-html');

const ALLOWED_SHORTCODES = new Set([
  'gallery', 'button', 'recent_posts', 'latest_posts', 'portal_services', 'emergency_contacts', 'subscribe', 'contact_form'
]);

function parseAttributes(attrString = '') {
  const attrs = {};
  const regex = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = sanitizeHtml(match[2], { allowedTags: [], allowedAttributes: {} });
  }
  return attrs;
}

function renderShortcode(name, attrs, inner, context = {}) {
  switch (name) {
    case 'button':
      return `<a class="btn btn-primary np-shortcode-btn" href="${attrs.url || '#'}">${attrs.label || inner || 'Click'}</a>`;
    case 'recent_posts':
    case 'latest_posts': {
      const posts = context.recentPosts || [];
      const limit = Number(attrs.limit) || 5;
      const items = posts.slice(0, limit).map((p) =>
        `<li><a href="/post/${p.slug}">${sanitizeHtml(p.title, { allowedTags: [], allowedAttributes: {} })}</a></li>`
      ).join('');
      return `<ul class="np-shortcode-recent-posts">${items}</ul>`;
    }
    case 'contact_form':
      return `<div class="np-shortcode-contact-form"><p><a class="btn btn-primary" href="${attrs.redirect || '/contact'}">${attrs.label || 'Contact us'}</a></p></div>`;
    case 'subscribe':
      return '<div class="np-shortcode-subscribe"><p>Subscribe to updates.</p></div>';
    default:
      return `<div class="np-shortcode np-shortcode-${name}">${inner || ''}</div>`;
  }
}

function parseShortcodes(content, context = {}) {
  if (!content || typeof content !== 'string') return content || '';
  return content.replace(/\[(\w+)([^\]]*)\]([\s\S]*?)\[\/\1\]/g, (full, name, attrPart, inner) => {
    if (!ALLOWED_SHORTCODES.has(name)) return full;
    return renderShortcode(name, parseAttributes(attrPart), inner, context);
  }).replace(/\[(\w+)([^\]]*)\]/g, (full, name, attrPart) => {
    if (!ALLOWED_SHORTCODES.has(name)) return full;
    return renderShortcode(name, parseAttributes(attrPart), '', context);
  });
}

module.exports = { parseShortcodes, ALLOWED_SHORTCODES, parseAttributes };
