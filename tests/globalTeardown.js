const fs = require('fs');
const path = require('path');

const runtimeFile = path.join(__dirname, '.test-runtime.json');

module.exports = async () => {
  if (fs.existsSync(runtimeFile)) {
    const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    if (runtime.TEST_DB_NAME) {
      process.env.TEST_DB_NAME = runtime.TEST_DB_NAME;
    }
    fs.unlinkSync(runtimeFile);
  }
  const { sequelize } = require('../server');
  await sequelize.close();
};
