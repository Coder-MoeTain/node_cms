const fs = require('fs');
const path = require('path');

/**
 * Resolve a vendor asset directory, preferring committed public/vendor copies
 * so production does not depend on node_modules being present.
 */
function resolveVendorDir(vendorName, nodeSubpath = '') {
  const publicDir = path.join(process.cwd(), 'public', 'vendor', vendorName);
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir).filter((name) => !name.startsWith('.'));
    if (files.length) return publicDir;
  }

  const nodeDir = path.join(process.cwd(), 'node_modules', vendorName, nodeSubpath);
  if (fs.existsSync(nodeDir)) return nodeDir;

  return publicDir;
}

module.exports = {
  resolveVendorDir
};
