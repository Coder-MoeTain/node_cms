const { listActivityLogs, createActivityLog } = require('../utils/activityLogHelper');
const { sequelize } = require('../models');

test('listActivityLogs returns empty array when table is missing', async () => {
  await sequelize.query('DROP TABLE IF EXISTS activity_logs');
  const rows = await listActivityLogs({ limit: 5 });
  expect(rows).toEqual([]);
});

test('createActivityLog ignores missing table', async () => {
  await sequelize.query('DROP TABLE IF EXISTS activity_logs');
  await expect(createActivityLog({
    action: 'test',
    entity_type: 'test'
  })).resolves.toBeNull();
});
