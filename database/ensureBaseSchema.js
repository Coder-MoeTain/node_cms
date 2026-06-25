const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.sql');

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function prepareSchemaStatements(sql) {
  return splitStatements(sql)
    .filter((statement) => !/^CREATE\s+DATABASE\b/i.test(statement))
    .filter((statement) => !/^USE\b/i.test(statement));
}

async function tableExists(sequelize, table, transaction) {
  const rows = await sequelize.query(
    `SELECT 1 AS exists_flag
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
     LIMIT 1`,
    {
      replacements: { table },
      type: sequelize.QueryTypes.SELECT,
      transaction
    }
  );
  return rows.length > 0;
}

async function ensureBaseSchema(sequelize) {
  if (await tableExists(sequelize, 'users')) {
    return false;
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Base schema file not found: ${schemaPath}`);
  }

  const statements = prepareSchemaStatements(fs.readFileSync(schemaPath, 'utf8'));
  if (!statements.length) {
    throw new Error('Base schema file is empty.');
  }

  await sequelize.transaction(async (transaction) => {
    for (const statement of statements) {
      await sequelize.query(statement, { transaction });
    }
  });

  return true;
}

module.exports = {
  ensureBaseSchema,
  prepareSchemaStatements,
  splitStatements
};
