const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

function isSafeEntryName(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) return false;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => part === '..' || part.startsWith('.'))) return false;
  return true;
}

async function findManifestInDir(dir, manifestName) {
  const direct = path.join(dir, manifestName);
  if (fs.existsSync(direct)) return { manifestPath: direct, root: dir };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(dir, entry.name, manifestName);
    if (fs.existsSync(nested)) {
      return { manifestPath: nested, root: path.join(dir, entry.name) };
    }
  }
  return null;
}

async function extractZipArchive(zipPath, targetRoot, manifestName) {
  if (!fs.existsSync(zipPath)) throw new Error('Archive file not found.');
  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds maximum allowed size (25 MB).');

  const tempDir = path.join(targetRoot, `.tmp-extract-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          if (!isSafeEntryName(entry.path)) {
            entry.autodrain();
            return;
          }
          const dest = path.join(tempDir, entry.path);
          if (entry.type === 'Directory') {
            fs.mkdirSync(dest, { recursive: true });
            entry.autodrain();
            return;
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          entry.pipe(fs.createWriteStream(dest));
        })
        .on('close', resolve)
        .on('error', reject);
    });

    const found = await findManifestInDir(tempDir, manifestName);
    if (!found) throw new Error(`${manifestName} was not found in the archive.`);

    const manifest = JSON.parse(fs.readFileSync(found.manifestPath, 'utf8'));
    if (!manifest.slug || !manifest.name) throw new Error('Manifest must include name and slug.');

    const finalDir = path.join(targetRoot, manifest.slug);
    if (fs.existsSync(finalDir)) {
      fs.rmSync(finalDir, { recursive: true, force: true });
    }
    fs.renameSync(found.root, finalDir);

    return { manifest, installPath: finalDir };
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
}

module.exports = { extractZipArchive, MAX_ARCHIVE_BYTES, isSafeEntryName };
