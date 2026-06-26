const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { WafSetting } = require('../models');
const { clearWafCache } = require('../middleware/waf');
const { ensureDirectory } = require('./fileHelper');
const { isZipMagicBytes } = require('./packageScan');
const { MAX_ARCHIVE_BYTES, MAX_UNCOMPRESSED_BYTES, isSafeEntryName } = require('./packageArchive');
const { uploadModelArchive, deleteRemoteModel } = require('./webguardClient');

const ALLOWED_MODEL_EXTENSIONS = new Set([
  '.joblib', '.pkl', '.pickle', '.json', '.yaml', '.yml', '.txt', '.md', '.npy', '.csv'
]);
const BLOCKED_MODEL_EXTENSIONS = new Set([
  '.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.jsp', '.asp', '.aspx', '.js', '.mjs', '.html', '.htm'
]);
const MAX_MODEL_FILES = 50;
const MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

function getModelsRoot() {
  const configured = String(process.env.WEBGUARD_MODELS_STORAGE || '').trim();
  const root = configured || path.join(process.cwd(), 'storage', 'webguard-models');
  ensureDirectory(root);
  return root;
}

function getRegistryPath() {
  return path.join(getModelsRoot(), 'registry.json');
}

function readRegistry() {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) return { models: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return { models: Array.isArray(parsed.models) ? parsed.models : [] };
  } catch {
    return { models: [] };
  }
}

function writeRegistry(registry) {
  const registryPath = getRegistryPath();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
}

function listFilesRecursive(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function scanModelDirectory(rootDir) {
  const issues = [];
  const files = listFilesRecursive(rootDir);
  if (!files.length) issues.push('Archive contains no files.');
  if (files.length > MAX_MODEL_FILES) {
    issues.push(`Archive contains too many files (${files.length}; max ${MAX_MODEL_FILES}).`);
  }
  for (const filePath of files) {
    const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    if (relative.includes('..')) issues.push(`Unsafe path "${relative}"`);
    if (BLOCKED_MODEL_EXTENSIONS.has(ext)) {
      issues.push(`Blocked file type "${ext}" in ${relative}`);
    }
    if (!ALLOWED_MODEL_EXTENSIONS.has(ext)) {
      issues.push(`Unsupported file type "${ext || '(none)'}" in ${relative}`);
    }
  }
  return issues;
}

function findModelArtifacts(rootDir) {
  const files = listFilesRecursive(rootDir);
  const joblibFiles = files
    .filter((filePath) => filePath.toLowerCase().endsWith('.joblib'))
    .map((filePath) => path.relative(rootDir, filePath).replace(/\\/g, '/'));
  if (!joblibFiles.length) return null;

  const preferred = joblibFiles.find((name) => path.basename(name).startsWith('rf_')) || joblibFiles[0];
  const modelId = path.basename(preferred, path.extname(preferred));
  return { modelId, joblibFiles, allFiles: files.map((f) => path.relative(rootDir, f).replace(/\\/g, '/')) };
}

function readOptionalManifest(rootDir) {
  const manifestPath = path.join(rootDir, 'model.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeModelId(value) {
  const id = String(value || '').trim();
  if (!MODEL_ID_PATTERN.test(id)) {
    throw new Error('Model ID must be 1–64 characters and use letters, numbers, dots, underscores, or hyphens.');
  }
  return id;
}

async function extractModelZip(zipPath, tempDir) {
  const directory = await unzipper.Open.file(zipPath);
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
      if (fileCount > MAX_MODEL_FILES) {
        throw new Error(`Archive contains too many files (max ${MAX_MODEL_FILES}).`);
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
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await new Promise((resolve, reject) => {
      entry.stream()
        .pipe(fs.createWriteStream(destination))
        .on('finish', resolve)
        .on('error', reject);
    });
  }
}

function copyDirectory(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

function syncToSharedModelsPath(modelId, sourceDir) {
  const sharedRoot = String(process.env.WEBGUARD_MODELS_PATH || '').trim();
  if (!sharedRoot) return { synced: false, reason: 'WEBGUARD_MODELS_PATH not configured' };
  const target = path.join(sharedRoot, modelId);
  copyDirectory(sourceDir, target);
  return { synced: true, path: target };
}

async function installModelFromZip(zipPath, options = {}) {
  if (!fs.existsSync(zipPath)) throw new Error('Model archive not found.');
  if (!isZipMagicBytes(zipPath)) throw new Error('File is not a valid ZIP archive.');

  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_ARCHIVE_BYTES) {
    throw new Error('Model archive exceeds maximum allowed size (25 MB).');
  }

  const tempDir = path.join(process.cwd(), 'tmp', 'quarantine', `ml-model-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await extractModelZip(zipPath, tempDir);

    const scanIssues = scanModelDirectory(tempDir);
    if (scanIssues.length) throw new Error(scanIssues.slice(0, 3).join('; '));

    const artifacts = findModelArtifacts(tempDir);
    if (!artifacts) {
      throw new Error('Archive must include at least one .joblib model file (e.g. rf_demo.joblib).');
    }

    const manifest = readOptionalManifest(tempDir);
    const modelId = normalizeModelId(options.modelId || manifest?.model_id || artifacts.modelId);
    const installDir = path.join(getModelsRoot(), modelId);

    if (fs.existsSync(installDir)) {
      fs.rmSync(installDir, { recursive: true, force: true });
    }
    copyDirectory(tempDir, installDir);

    const remote = await uploadModelArchive(zipPath, path.basename(zipPath), { modelId });
    const shared = syncToSharedModelsPath(modelId, installDir);

    const entry = {
      id: modelId,
      name: String(manifest?.name || modelId),
      files: artifacts.allFiles,
      joblib_files: artifacts.joblibFiles,
      installed_at: new Date().toISOString(),
      uploaded_by: options.userId || null,
      remote_synced: Boolean(remote.ok),
      remote_error: remote.ok ? null : (remote.error || 'Remote sync failed'),
      shared_path: shared.synced ? shared.path : null
    };

    const registry = readRegistry();
    registry.models = registry.models.filter((row) => row.id !== modelId);
    registry.models.unshift(entry);
    writeRegistry(registry);

    if (options.activate) {
      await activateModel(modelId);
    }

    return { model: entry, remote, shared };
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
}

function listModels() {
  const registry = readRegistry();
  return registry.models.sort((left, right) => String(right.installed_at).localeCompare(String(left.installed_at)));
}

async function activateModel(modelId) {
  const normalized = normalizeModelId(modelId);
  const exists = listModels().some((row) => row.id === normalized);
  if (!exists) throw new Error('Model not found.');

  await WafSetting.upsert({
    setting_key: 'ml_waf_model_id',
    setting_value: normalized,
    setting_type: 'string'
  });
  clearWafCache();
  return normalized;
}

async function deleteModel(modelId) {
  const normalized = normalizeModelId(modelId);
  const installDir = path.join(getModelsRoot(), normalized);
  if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });

  const sharedRoot = String(process.env.WEBGUARD_MODELS_PATH || '').trim();
  if (sharedRoot) {
    const sharedDir = path.join(sharedRoot, normalized);
    if (fs.existsSync(sharedDir)) fs.rmSync(sharedDir, { recursive: true, force: true });
  }

  await deleteRemoteModel(normalized);

  const registry = readRegistry();
  registry.models = registry.models.filter((row) => row.id !== normalized);
  writeRegistry(registry);

  const active = await WafSetting.findOne({ where: { setting_key: 'ml_waf_model_id' } });
  if (active?.setting_value === normalized) {
    await WafSetting.upsert({ setting_key: 'ml_waf_model_id', setting_value: '', setting_type: 'string' });
    clearWafCache();
  }
}

module.exports = {
  getModelsRoot,
  listModels,
  installModelFromZip,
  activateModel,
  deleteModel,
  normalizeModelId,
  MODEL_ID_PATTERN
};
