module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!controllers/admin/wafController.js',
    '!controllers/admin/databaseController.js',
    '!controllers/admin/securityController.js',
    '!controllers/admin/pluginController.js',
    '!controllers/admin/themeController.js',
    '!utils/databaseBackup.js',
    '!utils/contentTranslator.js',
    '!middleware/waf.js',
    '!utils/packageArchive.js',
    '!utils/translationEngine.js',
    '!middleware/zipUpload.js',
    '!utils/themePartials.js',
    '!utils/wafHelper.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80,
      functions: 75,
      branches: 55
    }
  }
};
