const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { isZipMagicBytes, scanExtractedDirectory, MAX_ARCHIVE_FILES } = require('./packageScan');

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

function isSafeEntryName(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) return false;
  if (/^[a-zA-Z]:/.test(normalized)) return false;
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

function moveDirectory(source, destination) {
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (!['EXDEV', 'EPERM', 'EEXIST'].includes(error.code)) throw error;
    if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
}

async function extractSafeEntries(directory, tempDir) {
  let totalUncompressed = 0;
  let fileCount = 0;

  for (const entry of directory.files) {
    if (!isSafeEntryName(entry.path)) {
      throw new Error(`Unsafe archive entry blocked: ${entry.path}`);
    }
    if (entry.type === 'SymbolicLink' || entry.type === 'symlink') {
      throw new Error(`Symlink entries are not allowed: ${entry.path}`);
    }
    if (entry.type === 'File') {
      fileCount += 1;
      if (fileCount > MAX_ARCHIVE_FILES) {
        throw new Error(`Archive contains too many files (max ${MAX_ARCHIVE_FILES}).`);
      }
      totalUncompressed += Number(entry.uncompressedSize || 0);
      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
        throw new Error('Archive uncompressed size exceeds maximum allowed limit (100 MB).');
      }
    }
  }

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const destination = path.join(tempDir, entry.path.replace(/\\/g, '/'));
    ensureParent(destination);
    await new Promise((resolve, reject) => {
      entry.stream()
        .pipe(fs.createWriteStream(destination))
        .on('finish', resolve)
        .on('error', reject);
    });
  }
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function extractZipArchive(zipPath, targetRoot, manifestName) {
  if (!fs.existsSync(zipPath)) throw new Error('Archive file not found.');
  if (!isZipMagicBytes(zipPath)) throw new Error('File is not a valid ZIP archive.');

  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds maximum allowed size (25 MB).');

  const tempDir = path.join(targetRoot, `.tmp-extract-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const directory = await unzipper.Open.file(zipPath);
    await extractSafeEntries(directory, tempDir);

    const scanIssues = scanExtractedDirectory(tempDir, {
      archiveType: manifestName === 'theme.json' ? 'theme' : 'plugin'
    });
    if (scanIssues.length) {
      throw new Error(scanIssues.slice(0, 3).join('; '));
    }

    const found = await findManifestInDir(tempDir, manifestName);
    if (!found) throw new Error(`${manifestName} was not found in the archive.`);

    const manifest = JSON.parse(fs.readFileSync(found.manifestPath, 'utf8'));
    if (!manifest.slug || !manifest.name) throw new Error('Manifest must include name and slug.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.slug)) {
      throw new Error(`Invalid slug "${manifest.slug}". Use lowercase letters, numbers, and hyphens.`);
    }

    const finalDir = path.join(targetRoot, manifest.slug);
    if (fs.existsSync(finalDir)) {
      const backupDir = path.join(targetRoot, `.backup-${manifest.slug}-${Date.now()}`);
      fs.renameSync(finalDir, backupDir);
      try {
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup of the pre-overwrite backup directory.
      }
    }
    moveDirectory(found.root, finalDir);

    return { manifest, installPath: finalDir };
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
}

module.exports = {
  extractZipArchive,
  MAX_ARCHIVE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  isSafeEntryName
};
