/**
 * Resolve an isolated MySQL database name for NODE_ENV=test.
 * Never allow TEST_DB_NAME to match the production DB_NAME.
 */
function resolveIsolatedTestDatabaseName(env = process.env) {
  const productionDb = env.DB_NAME || 'nodepress_cms';
  let testDb = env.TEST_DB_NAME || 'nodepress_cms_test';
  if (testDb === productionDb) {
    testDb = `${productionDb}_test`;
  }
  return testDb;
}

async function authenticateWithRetry(sequelize, label = 'MySQL', attempts = 20, delayMs = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`${label} not ready (attempt ${attempt}/${attempts}): ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = {
  resolveIsolatedTestDatabaseName,
  authenticateWithRetry
};
