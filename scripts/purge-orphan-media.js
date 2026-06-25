require('dotenv').config();
const { Media } = require('../models');
const { mediaFileExists } = require('../utils/mediaHelper');

async function purgeOrphanMedia() {
  const rows = await Media.findAll();
  let removed = 0;
  for (const row of rows) {
    if (!mediaFileExists(row.file_path)) {
      await row.destroy();
      removed += 1;
      console.log(`Removed orphan media #${row.id}: ${row.original_name}`);
    }
  }
  console.log(removed ? `Purged ${removed} orphan media record(s).` : 'No orphan media records found.');
}

purgeOrphanMedia()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Media.sequelize.close();
  });
