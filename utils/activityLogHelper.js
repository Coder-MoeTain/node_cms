const { ActivityLog } = require('../models');

function isMissingActivityLogsError(error) {
  const message = String(error?.message || '');
  const code = error?.parent?.code || error?.original?.code;
  return code === 'ER_NO_SUCH_TABLE' || /activity_logs.*doesn't exist/i.test(message);
}

async function listActivityLogs(options = {}) {
  try {
    return await ActivityLog.findAll(options);
  } catch (error) {
    if (isMissingActivityLogsError(error)) return [];
    throw error;
  }
}

async function createActivityLog(entry) {
  try {
    return await ActivityLog.create(entry);
  } catch (error) {
    if (isMissingActivityLogsError(error)) return null;
    throw error;
  }
}

module.exports = {
  listActivityLogs,
  createActivityLog,
  isMissingActivityLogsError
};
