const fs = require('fs');
const path = require('path');

/** Must run in setupFiles (before test modules import server). */
const runtimeFile = path.join(__dirname, '.test-runtime.json');
if (fs.existsSync(runtimeFile)) {
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  if (runtime.TEST_DB_NAME) {
    process.env.TEST_DB_NAME = runtime.TEST_DB_NAME;
  }
}
