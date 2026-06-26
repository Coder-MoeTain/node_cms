const fs = require('fs');
const os = require('os');
const path = require('path');
const { createZipArchive } = require('./helpers/zipFixtures');

describe('webguardModelManager', () => {
  let storageRoot;

  beforeEach(() => {
    jest.resetModules();
    storageRoot = path.join(os.tmpdir(), `wg-models-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(storageRoot, { recursive: true });
    process.env.WEBGUARD_MODELS_STORAGE = storageRoot;
    delete process.env.WEBGUARD_MODELS_PATH;
    delete process.env.WEBGUARD_API_URL;
    delete process.env.WEBGUARD_API_KEY;
  });

  afterEach(() => {
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
    delete process.env.WEBGUARD_MODELS_STORAGE;
  });

  test('installs a model zip with rf_*.joblib', async () => {
    const zipPath = path.join(storageRoot, 'model.zip');
    createZipArchive({
      'rf_demo.joblib': 'fake-model-bytes',
      'preprocessor.joblib': 'fake-preprocessor'
    }, zipPath);

    const manager = require('../utils/webguardModelManager');
    const result = await manager.installModelFromZip(zipPath, { userId: 1 });

    expect(result.model.id).toBe('rf_demo');
    expect(result.model.remote_synced).toBe(false);
    expect(fs.existsSync(path.join(storageRoot, 'rf_demo', 'rf_demo.joblib'))).toBe(true);

    const models = manager.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('rf_demo');
  });

  test('rejects archives without joblib files', async () => {
    const zipPath = path.join(storageRoot, 'bad.zip');
    createZipArchive({ 'readme.txt': 'no model here' }, zipPath);

    const manager = require('../utils/webguardModelManager');
    await expect(manager.installModelFromZip(zipPath)).rejects.toThrow(/\.joblib/);
  });

  test('deleteModel removes installed files and registry entry', async () => {
    const zipPath = path.join(storageRoot, 'model.zip');
    createZipArchive({ 'rf_test.joblib': 'bytes' }, zipPath);

    const manager = require('../utils/webguardModelManager');
    await manager.installModelFromZip(zipPath);
    await manager.deleteModel('rf_test');

    expect(manager.listModels()).toHaveLength(0);
    expect(fs.existsSync(path.join(storageRoot, 'rf_test'))).toBe(false);
  });
});
