const fs = require('fs');
const path = require('path');
const { buildThemeScreenshotSvg } = require('../utils/themeScreenshotArt');

const themesRoot = path.join(__dirname, '..', 'themes');

function loadManifest(slug) {
  const filePath = path.join(themesRoot, slug, 'theme.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const slugs = fs.readdirSync(themesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(themesRoot, entry.name, 'theme.json')))
  .map((entry) => entry.name)
  .sort();

let count = 0;
for (const slug of slugs) {
  const manifest = loadManifest(slug);
  const svg = buildThemeScreenshotSvg(manifest);
  const outPath = path.join(themesRoot, slug, 'screenshot.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  count += 1;
  console.log(`  ${slug} -> screenshot.svg`);
}

console.log(`Generated ${count} WordPress-style theme screenshot assets.`);
