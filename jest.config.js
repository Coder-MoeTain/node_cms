module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!utils/databaseBackup.js',
    '!utils/contentTranslator.js',
    '!middleware/waf.js',
    '!utils/translationEngine.js',
    '!controllers/admin/wafController.js',
    '!controllers/admin/databaseController.js',
    '!controllers/admin/commentController.js',
    '!utils/widgetRenderer.js',
    '!utils/updateChecker.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 73,
      statements: 70,
      functions: 75,
      branches: 55
    }
  }
};
