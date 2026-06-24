const themeLoader = require('./themeLoader');

const PUBLIC_PARTIALS = [
  'head',
  'header',
  'footer',
  'sidebar',
  'standard-sidebar',
  'portal-ticker',
  'post-card',
  'portal-post-item',
  'portal-empty',
  'home-portal',
  'index'
];

async function resolveThemePartials() {
  const map = {};
  for (const name of PUBLIC_PARTIALS) {
    map[name] = await themeLoader.resolvePartial(name);
  }
  return map;
}

function partialIncludePath(themePartials, name) {
  if (themePartials && themePartials[name]) return themePartials[name];
  return `public/partials/${name}`;
}

module.exports = { PUBLIC_PARTIALS, resolveThemePartials, partialIncludePath };
