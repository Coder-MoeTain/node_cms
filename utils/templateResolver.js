const fs = require('fs');
const path = require('path');

const DEFAULT_THEME = 'classic-blog';
const DEFAULT_PUBLIC_ROOT = path.join(process.cwd(), 'views', 'public');

const LEGACY_ALIASES = {
  category: 'archive',
  tag: 'archive',
  '404': 'error',
  blog: 'blog',
  post: 'post',
  home: 'home',
  page: 'page',
  search: 'search',
  contact: 'contact',
  archive: 'archive',
  error: 'error'
};

function sanitizeTemplateName(name) {
  const raw = String(name || '').replace(/\\/g, '/').split('/').pop() || '';
  const cleaned = raw.replace(/\.ejs$/i, '').replace(/[^a-z0-9_-]/gi, '');
  if (!cleaned || cleaned.includes('..')) {
    throw new Error(`Invalid template name "${name}".`);
  }
  return cleaned;
}

function buildHierarchy(type, context = {}) {
  const t = sanitizeTemplateName(type);
  const slug = context.slug ? sanitizeTemplateName(context.slug) : null;
  const postType = context.postType ? sanitizeTemplateName(context.postType) : 'post';

  switch (t) {
    case 'home':
      if (context.isFrontPage) return ['front-page', 'home', 'blog', 'index'];
      return ['home', 'blog', 'index'];
    case 'front-page':
      return ['front-page', 'home', 'blog', 'index'];
    case 'blog':
      return ['blog', 'home', 'index'];
    case 'post':
    case 'single':
      return [`single-${postType}`, 'single', 'post', 'index'];
    case 'page':
      if (slug) return [`page-${slug}`, 'page', 'index'];
      return ['page', 'index'];
    case 'archive':
      if (postType && postType !== 'post') return [`archive-${postType}`, 'archive', 'blog', 'index'];
      return ['archive', 'blog', 'index'];
    case 'category':
      if (slug) return [`category-${slug}`, 'category', 'archive', 'blog', 'index'];
      return ['category', 'archive', 'blog', 'index'];
    case 'tag':
      if (slug) return [`tag-${slug}`, 'tag', 'archive', 'blog', 'index'];
      return ['tag', 'archive', 'blog', 'index'];
    case 'search':
      return ['search', 'index'];
    case '404':
    case 'error':
      return ['404', 'error', 'index'];
    default:
      if (t.startsWith('single-') || t.startsWith('page-') || t.startsWith('archive-') ||
          t.startsWith('category-') || t.startsWith('tag-')) {
        return [t, LEGACY_ALIASES[t.split('-')[0]] || t, 'index'];
      }
      return [t, LEGACY_ALIASES[t] || t, 'index'];
  }
}

function templateExistsInChain(chain, template, themesRoot) {
  for (const theme of chain) {
    const candidate = path.join(theme.path, 'templates', `${template}.ejs`);
    if (fs.existsSync(candidate)) return candidate;
  }
  const publicTemplate = path.join(DEFAULT_PUBLIC_ROOT, `${template}.ejs`);
  if (fs.existsSync(publicTemplate)) return publicTemplate;
  return null;
}

function toViewPath(absolutePath) {
  const rel = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
  if (rel.startsWith('views/public/')) return rel.replace(/^views\//, '').replace(/\.ejs$/, '');
  if (rel.startsWith('themes/')) return rel.replace(/\.ejs$/, '');
  return rel.replace(/\.ejs$/, '');
}

function resolveTemplatePath(type, context, { chain, themesRoot }) {
  const candidates = [...new Set(buildHierarchy(type, context))];
  for (const name of candidates) {
    const resolved = templateExistsInChain(chain, name, themesRoot);
    if (resolved) return toViewPath(resolved);
  }
  return 'errors/404';
}

function resolvePartialPath(name, { chain }) {
  const partial = sanitizeTemplateName(name);
  for (const theme of chain) {
    const candidate = path.join(theme.path, 'partials', `${partial}.ejs`);
    if (fs.existsSync(candidate)) return toViewPath(candidate);
  }
  const publicPartial = path.join(DEFAULT_PUBLIC_ROOT, 'partials', `${partial}.ejs`);
  if (fs.existsSync(publicPartial)) return `public/partials/${partial}`;
  const publicRoot = path.join(DEFAULT_PUBLIC_ROOT, `${partial}.ejs`);
  if (fs.existsSync(publicRoot)) return `public/${partial}`;
  return `public/partials/${partial}`;
}

module.exports = {
  DEFAULT_THEME,
  sanitizeTemplateName,
  buildHierarchy,
  resolveTemplatePath,
  resolvePartialPath,
  templateExistsInChain,
  toViewPath,
  LEGACY_ALIASES
};
