const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { TwoFactorRecoveryCode } = require('../models');

function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const segment = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${segment.slice(0, 4)}-${segment.slice(4, 8)}`);
  }
  return codes;
}

async function replaceRecoveryCodes(userId, plainCodes) {
  await TwoFactorRecoveryCode.destroy({ where: { user_id: userId } });
  for (const code of plainCodes) {
    await TwoFactorRecoveryCode.create({
      user_id: userId,
      code_hash: await bcrypt.hash(code.replace(/-/g, '').toLowerCase(), 10)
    });
  }
}

async function consumeRecoveryCode(userId, submitted) {
  if (!submitted || typeof submitted !== 'string') return false;
  const normalized = submitted.replace(/[\s-]/g, '').toLowerCase();
  if (normalized.length < 8) return false;

  const rows = await TwoFactorRecoveryCode.findAll({
    where: { user_id: userId, used_at: null }
  });
  for (const row of rows) {
    const match = await bcrypt.compare(normalized, row.code_hash);
    if (match) {
      await row.update({ used_at: new Date() });
      return true;
    }
  }
  return false;
}

async function clearRecoveryCodes(userId) {
  await TwoFactorRecoveryCode.destroy({ where: { user_id: userId } });
}

module.exports = {
  generateRecoveryCodes,
  replaceRecoveryCodes,
  consumeRecoveryCode,
  clearRecoveryCodes
};
