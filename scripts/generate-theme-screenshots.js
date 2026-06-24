const fs = require('fs');
const path = require('path');

const themes = [
  ['classic-blog', '#2271b1', '#ffffff', '#1d2327'],
  ['modern-news', '#4f46e5', '#ffffff', '#1e1b4b'],
  ['minimal-personal', '#50575e', '#f6f7f7', '#1d2327'],
  ['corporate-business', '#008a20', '#ffffff', '#1d2327'],
  ['magazine-grid', '#d97706', '#fffbeb', '#292524'],
  ['dark-elegant', '#38bdf8', '#0f172a', '#f8fafc'],
  ['government-portal', '#006ba6', '#e8edf2', '#2b2b2b'],
  ['creative-studio', '#7c3aed', '#faf5ff', '#1e1b4b'],
  ['education-campus', '#1e40af', '#f8fafc', '#1e293b'],
  ['ecommerce-store', '#111827', '#ffffff', '#111827']
];

function buildSvg(slug, primary, bg, text) {
  const card = bg === '#0f172a' ? '#1e293b' : '#ffffff';
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" role="img">',
    `  <rect width="400" height="300" fill="${bg}"/>`,
    `  <rect width="400" height="44" fill="${primary}"/>`,
    `  <rect x="16" y="12" width="80" height="20" rx="3" fill="${card}" opacity="0.9"/>`,
    `  <rect x="280" y="16" width="48" height="12" rx="2" fill="${card}" opacity="0.5"/>`,
    `  <rect x="340" y="16" width="44" height="12" rx="2" fill="${card}" opacity="0.5"/>`,
    `  <rect x="20" y="60" width="360" height="72" rx="6" fill="${card}" stroke="${primary}" stroke-width="1"/>`,
    `  <rect x="36" y="76" width="200" height="14" rx="2" fill="${text}" opacity="0.25"/>`,
    `  <rect x="36" y="98" width="280" height="10" rx="2" fill="${text}" opacity="0.15"/>`,
    `  <rect x="20" y="148" width="170" height="100" rx="4" fill="${card}" stroke="${text}" stroke-width="0.5" opacity="0.25"/>`,
    `  <rect x="205" y="148" width="170" height="100" rx="4" fill="${card}" stroke="${text}" stroke-width="0.5" opacity="0.25"/>`,
    `  <rect x="0" y="268" width="400" height="32" fill="${primary}" opacity="0.85"/>`,
    `  <text x="200" y="288" text-anchor="middle" fill="${card}" font-family="Arial,sans-serif" font-size="11">${slug}</text>`,
    '</svg>'
  ].join('\n');
}

for (const [slug, primary, bg, text] of themes) {
  const dir = path.join(__dirname, '..', 'themes', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'screenshot.svg'), buildSvg(slug, primary, bg, text));
}

console.log(`Generated ${themes.length} theme screenshots.`);
