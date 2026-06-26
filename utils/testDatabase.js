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

module.exports = {
  resolveIsolatedTestDatabaseName
};
