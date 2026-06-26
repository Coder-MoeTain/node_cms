const THEME_LAYOUT = {
  'classic-blog': 'blog',
  'modern-news': 'news',
  'minimal-personal': 'minimal',
  'myanmar-portal': 'portal',
  'government-portal': 'portal',
  'magazine-grid': 'magazine',
  'corporate-business': 'corporate',
  'creative-studio': 'creative',
  'dark-elegant': 'dark',
  'ecommerce-store': 'shop',
  'education-campus': 'education'
};

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colorsFromManifest(manifest = {}) {
  const d = manifest.defaults || {};
  return {
    primary: d.primary_color || '#2271b1',
    secondary: d.secondary_color || '#50575e',
    background: d.background_color || '#ffffff',
    text: d.text_color || '#1d2327',
    card: d.dark_mode ? '#1e293b' : '#ffffff',
    muted: d.dark_mode ? '#334155' : '#f0f0f1'
  };
}

function photoGradient(id, c, tone = 'sky') {
  const stops = tone === 'warm'
    ? [`<stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="${escapeXml(c.primary)}" stop-opacity="0.85"/><stop offset="100%" stop-color="#78350f" stop-opacity="0.7"/>`]
    : tone === 'green'
      ? [`<stop offset="0%" stop-color="#86efac"/><stop offset="50%" stop-color="${escapeXml(c.primary)}" stop-opacity="0.75"/><stop offset="100%" stop-color="#14532d" stop-opacity="0.8"/>`]
      : tone === 'night'
        ? [`<stop offset="0%" stop-color="#1e293b"/><stop offset="40%" stop-color="${escapeXml(c.primary)}" stop-opacity="0.5"/><stop offset="100%" stop-color="#020617"/>`]
        : [`<stop offset="0%" stop-color="#93c5fd"/><stop offset="45%" stop-color="${escapeXml(c.primary)}" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e3a5f" stop-opacity="0.75"/>`];
  return `<linearGradient id="pg-${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops.join('')}</linearGradient>`;
}

function photoRect(id, x, y, w, h, rx = 4) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#pg-${id})"/>
    <path d="M${x + 8} ${y + h - 6} L${x + w * 0.35} ${y + h * 0.55} L${x + w * 0.55} ${y + h * 0.72} L${x + w - 10} ${y + h - 14} L${x + w - 8} ${y + h - 6} Z" fill="#000" opacity="0.12"/>
    <circle cx="${x + w - 18}" cy="${y + 16}" r="9" fill="#fff" opacity="0.35"/>`;
}

function navBar(y, h, c, centered = false) {
  const logoX = centered ? 156 : 16;
  return `<rect y="${y}" width="400" height="${h}" fill="${escapeXml(c.primary)}"/>
    <rect x="${logoX}" y="${y + 10}" width="88" height="22" rx="4" fill="${escapeXml(c.card)}" opacity="0.95"/>
    <rect x="250" y="${y + 16}" width="42" height="10" rx="2" fill="${escapeXml(c.card)}" opacity="0.45"/>
    <rect x="300" y="${y + 16}" width="36" height="10" rx="2" fill="${escapeXml(c.card)}" opacity="0.45"/>
    <rect x="346" y="${y + 16}" width="38" height="10" rx="2" fill="${escapeXml(c.card)}" opacity="0.45"/>`;
}

function textLines(x, y, c, widths = [160, 120, 200]) {
  return widths.map((w, i) =>
    `<rect x="${x}" y="${y + i * 14}" width="${w}" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="${0.28 - i * 0.05}"/>`
  ).join('');
}

function footerBar(c) {
  return `<rect y="268" width="400" height="32" fill="${escapeXml(c.primary)}" opacity="0.92"/>
    <rect x="24" y="278" width="70" height="8" rx="2" fill="${escapeXml(c.card)}" opacity="0.5"/>
    <rect x="110" y="278" width="55" height="8" rx="2" fill="${escapeXml(c.card)}" opacity="0.35"/>
    <rect x="300" y="278" width="76" height="8" rx="2" fill="${escapeXml(c.card)}" opacity="0.35"/>`;
}

function layoutBlog(c, name) {
  const gradients = [photoGradient('hero', c, 'sky'), photoGradient('p1', c, 'green'), photoGradient('p2', c, 'warm')].join('');
  const body = `${navBar(0, 44, c)}
    ${photoRect('hero', 0, 44, 400, 78, 0)}
    <rect x="20" y="134" width="250" height="118" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.5" opacity="0.18"/>
    ${textLines(32, 148, c, [180, 140, 200])}
    ${photoRect('p1', 32, 198, 100, 42)}
    <rect x="282" y="134" width="98" height="118" rx="5" fill="${escapeXml(c.muted)}" opacity="0.55"/>
    ${textLines(294, 148, c, [70, 62, 74])}
    <rect x="20" y="262" width="170" height="0" opacity="0"/>
    <rect x="20" y="218" width="250" height="28" rx="4" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.4" opacity="0.12"/>
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutNews(c, name) {
  const gradients = [photoGradient('hero', c, 'sky'), photoGradient('t1', c, 'sky'), photoGradient('t2', c, 'warm')].join('');
  const body = `${navBar(0, 44, c, true)}
    <rect x="20" y="56" width="360" height="52" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="1"/>
    ${textLines(36, 68, c, [220, 280])}
    ${photoRect('t1', 20, 118, 88, 66)}
    <rect x="118" y="118" width="262" height="66" rx="4" fill="${escapeXml(c.card)}" opacity="0.2"/>
    ${textLines(130, 128, c, [200, 160, 140])}
    ${photoRect('t2', 20, 194, 88, 66)}
    <rect x="118" y="194" width="262" height="66" rx="4" fill="${escapeXml(c.card)}" opacity="0.2"/>
    ${textLines(130, 204, c, [190, 150])}
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutMinimal(c, name) {
  const gradients = photoGradient('hero', c, 'warm');
  const body = `${navBar(0, 40, c, true)}
    <rect x="70" y="58" width="260" height="10" rx="2" fill="${escapeXml(c.text)}" opacity="0.2"/>
    ${photoRect('hero', 70, 78, 260, 88, 6)}
    <rect x="70" y="178" width="260" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.16"/>
    <rect x="70" y="194" width="220" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.12"/>
    <rect x="70" y="210" width="240" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.1"/>
    <rect x="70" y="234" width="180" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.08"/>
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutPortal(c, name) {
  const gradients = [photoGradient('hero', c, 'sky'), photoGradient('s1', c, 'green'), photoGradient('s2', c, 'warm'), photoGradient('s3', c, 'sky')].join('');
  const body = `<rect width="400" height="18" fill="${escapeXml(c.secondary)}"/>
    <rect x="16" y="5" width="72" height="8" rx="2" fill="${escapeXml(c.card)}" opacity="0.45"/>
    <rect x="300" y="5" width="84" height="8" rx="2" fill="${escapeXml(c.card)}" opacity="0.45"/>
    ${navBar(18, 48, c)}
    ${photoRect('hero', 0, 66, 400, 72, 0)}
    <rect x="20" y="148" width="116" height="96" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.5" opacity="0.2"/>
    ${photoRect('s1', 28, 158, 100, 44)}
    ${textLines(28, 210, c, [88, 72])}
    <rect x="142" y="148" width="116" height="96" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.5" opacity="0.2"/>
    ${photoRect('s2', 150, 158, 100, 44)}
    ${textLines(150, 210, c, [88, 72])}
    <rect x="264" y="148" width="116" height="96" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.5" opacity="0.2"/>
    ${photoRect('s3', 272, 158, 100, 44)}
    ${textLines(272, 210, c, [88, 72])}
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutMagazine(c, name) {
  const gradients = [photoGradient('h', c, 'warm'), photoGradient('a', c, 'sky'), photoGradient('b', c, 'green'), photoGradient('c', c, 'warm')].join('');
  const body = `${navBar(0, 44, c)}
    ${photoRect('h', 0, 44, 400, 64, 0)}
    ${photoRect('a', 16, 118, 115, 80)}
    ${photoRect('b', 142, 118, 115, 80)}
    ${photoRect('c', 268, 118, 116, 80)}
    <rect x="16" y="206" width="115" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.2"/>
    <rect x="142" y="206" width="115" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.2"/>
    <rect x="268" y="206" width="100" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.2"/>
    <rect x="16" y="222" width="180" height="36" rx="4" fill="${escapeXml(c.muted)}" opacity="0.45"/>
    <rect x="204" y="222" width="180" height="36" rx="4" fill="${escapeXml(c.muted)}" opacity="0.45"/>
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutCorporate(c, name) {
  const gradients = [photoGradient('hero', c, 'green'), photoGradient('p1', c, 'green'), photoGradient('p2', c, 'sky')].join('');
  const body = `${navBar(0, 44, c)}
    ${photoRect('hero', 20, 54, 360, 58, 5)}
    <rect x="20" y="124" width="228" height="120" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.text)}" stroke-width="0.4" opacity="0.15"/>
    ${textLines(34, 138, c, [180, 160, 190])}
    ${photoRect('p1', 34, 188, 90, 44)}
    <rect x="262" y="124" width="118" height="120" rx="5" fill="${escapeXml(c.muted)}" opacity="0.5"/>
    ${textLines(276, 138, c, [82, 74, 68])}
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutCreative(c, name) {
  const gradients = [photoGradient('big', c, 'warm'), photoGradient('s1', c, 'sky'), photoGradient('s2', c, 'warm')].join('');
  const body = `<rect width="400" height="300" fill="${escapeXml(c.background)}"/>
    <rect x="0" y="0" width="140" height="300" fill="${escapeXml(c.primary)}" opacity="0.12"/>
    ${navBar(0, 40, c)}
    ${photoRect('big', 20, 52, 220, 120, 8)}
    <rect x="252" y="52" width="128" height="56" rx="6" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="1"/>
    ${textLines(266, 66, c, [96, 88])}
    ${photoRect('s1', 252, 118, 60, 54)}
    ${photoRect('s2', 320, 118, 60, 54)}
    <rect x="20" y="184" width="360" height="10" rx="2" fill="${escapeXml(c.text)}" opacity="0.18"/>
    <rect x="20" y="202" width="300" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.1"/>
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body, false);
}

function layoutDark(c, name) {
  const gradients = [photoGradient('hero', c, 'night'), photoGradient('p1', c, 'night'), photoGradient('p2', c, 'night')].join('');
  const body = `${navBar(0, 44, c)}
    ${photoRect('hero', 0, 44, 400, 70, 0)}
    <rect x="20" y="126" width="170" height="110" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="0.6" opacity="0.55"/>
    ${photoRect('p1', 28, 136, 154, 48)}
    ${textLines(28, 192, c, [140, 120])}
    <rect x="205" y="126" width="175" height="110" rx="5" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="0.6" opacity="0.55"/>
    ${photoRect('p2', 213, 136, 159, 48)}
    ${textLines(213, 192, c, [140, 120])}
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutShop(c, name) {
  const gradients = [photoGradient('p1', c, 'sky'), photoGradient('p2', c, 'warm'), photoGradient('p3', c, 'green'), photoGradient('p4', c, 'sky')].join('');
  const body = `${navBar(0, 44, c)}
    <rect x="20" y="54" width="360" height="28" rx="4" fill="${escapeXml(c.muted)}" opacity="0.55"/>
    <rect x="36" y="64" width="120" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.2"/>
    ${photoRect('p1', 20, 92, 82, 82)}
    ${photoRect('p2', 112, 92, 82, 82)}
    ${photoRect('p3', 204, 92, 82, 82)}
    ${photoRect('p4', 296, 92, 84, 82)}
    <rect x="20" y="182" width="82" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.18"/>
    <rect x="112" y="182" width="82" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.18"/>
    <rect x="204" y="182" width="82" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.18"/>
    <rect x="296" y="182" width="82" height="8" rx="2" fill="${escapeXml(c.text)}" opacity="0.18"/>
    <rect x="20" y="198" width="360" height="56" rx="5" fill="${escapeXml(c.muted)}" opacity="0.35"/>
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function layoutEducation(c, name) {
  const gradients = [photoGradient('hero', c, 'sky'), photoGradient('c1', c, 'green'), photoGradient('c2', c, 'warm')].join('');
  const body = `${navBar(0, 44, c)}
    ${photoRect('hero', 0, 44, 400, 68, 0)}
    <rect x="20" y="122" width="175" height="118" rx="6" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="0.8" opacity="0.25"/>
    ${photoRect('c1', 30, 132, 155, 52)}
    ${textLines(30, 194, c, [150, 130])}
    <rect x="205" y="122" width="175" height="118" rx="6" fill="${escapeXml(c.card)}" stroke="${escapeXml(c.primary)}" stroke-width="0.8" opacity="0.25"/>
    ${photoRect('c2', 215, 132, 155, 52)}
    ${textLines(215, 194, c, [150, 130])}
    ${footerBar(c)}`;
  return wrapSvg(name, c, gradients, body);
}

function wrapSvg(name, c, gradients, body, paintBackground = true) {
  const bg = paintBackground ? `<rect width="400" height="300" fill="${escapeXml(c.background)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 400 300" role="img" aria-label="${escapeXml(name)} theme preview">
  <defs>${gradients}</defs>
  ${bg}
  ${body}
</svg>`;
}

const LAYOUT_BUILDERS = {
  blog: layoutBlog,
  news: layoutNews,
  minimal: layoutMinimal,
  portal: layoutPortal,
  magazine: layoutMagazine,
  corporate: layoutCorporate,
  creative: layoutCreative,
  dark: layoutDark,
  shop: layoutShop,
  education: layoutEducation
};

function buildThemeScreenshotSvg(manifest = {}) {
  const slug = manifest.slug || 'theme';
  const name = manifest.name || slug;
  const layout = THEME_LAYOUT[slug] || 'blog';
  const c = colorsFromManifest(manifest);
  const builder = LAYOUT_BUILDERS[layout] || layoutBlog;
  return builder(c, name);
}

function getThemeLayoutType(slug) {
  return THEME_LAYOUT[slug] || 'blog';
}

module.exports = {
  buildThemeScreenshotSvg,
  getThemeLayoutType,
  THEME_LAYOUT,
  colorsFromManifest
};
