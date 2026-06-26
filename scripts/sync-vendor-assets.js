const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const vendorCopies = [
  {
    from: path.join(root, 'node_modules', 'cropperjs', 'dist'),
    to: path.join(root, 'public', 'vendor', 'cropperjs'),
    files: ['cropper.min.css', 'cropper.min.js', 'cropper.css', 'cropper.js']
  }
];

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function syncVendorAssets() {
  let copied = 0;
  for (const entry of vendorCopies) {
    if (!fs.existsSync(entry.from)) {
      console.warn(`[sync-vendor-assets] Skipping missing source: ${entry.from}`);
      continue;
    }
    fs.mkdirSync(entry.to, { recursive: true });
    for (const file of entry.files) {
      const source = path.join(entry.from, file);
      if (!fs.existsSync(source)) continue;
      copyFile(source, path.join(entry.to, file));
      copied += 1;
    }
  }
  console.log(`[sync-vendor-assets] Copied ${copied} vendor file(s) to public/vendor/`);
}

if (require.main === module) {
  syncVendorAssets();
}

module.exports = { syncVendorAssets };
