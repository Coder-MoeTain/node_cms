#!/usr/bin/env node
/**
 * Delete the seed super-admin (admin@example.com) and recreate it.
 *
 * Usage: node database/reset-admin.js
 *        node database/reset-admin.js --email=other@example.com
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const {
  sequelize,
  Role,
  User,
  Post,
  Page,
  Media,
  ActivityLog,
  WafLog,
  PasswordResetToken,
  TwoFactorRecoveryCode
} = require('../models');

const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_PASSWORD = 'Admin@12345';
const DEFAULT_NAME = 'Super Admin';

function parseEmail() {
  const arg = process.argv.find((a) => a.startsWith('--email='));
  return arg ? arg.slice(8).trim() : DEFAULT_EMAIL;
}

async function removeUserReferences(userId, transaction) {
  await Post.update({ author_id: null }, { where: { author_id: userId }, transaction });
  await Page.update({ author_id: null }, { where: { author_id: userId }, transaction });
  await Media.update({ uploaded_by: null }, { where: { uploaded_by: userId }, transaction });
  await ActivityLog.destroy({ where: { user_id: userId }, transaction });
  await WafLog.update({ user_id: null }, { where: { user_id: userId }, transaction });
  await PasswordResetToken.destroy({ where: { user_id: userId }, transaction });
  await TwoFactorRecoveryCode.destroy({ where: { user_id: userId }, transaction });
}

async function resetAdmin() {
  const email = parseEmail();

  await sequelize.authenticate();

  const superAdminRole = await Role.findOne({ where: { slug: 'super-admin' } });
  if (!superAdminRole) {
    throw new Error('Super Admin role not found. Run npm run seed first.');
  }

  await sequelize.transaction(async (transaction) => {
    const existing = await User.findOne({ where: { email }, transaction });

    if (existing) {
      console.log(`Removing user: ${email} (id ${existing.id})`);
      await removeUserReferences(existing.id, transaction);
      await existing.destroy({ transaction, force: true });
      console.log('Deleted (hard delete).');
    } else {
      console.log(`No active user found for ${email}; checking soft-deleted rows...`);
      const [rows] = await sequelize.query(
        'SELECT id FROM users WHERE email = ?',
        { replacements: [email], transaction }
      );
      for (const row of rows) {
        await removeUserReferences(row.id, transaction);
        await sequelize.query('DELETE FROM users WHERE id = ?', {
          replacements: [row.id],
          transaction
        });
        console.log(`Hard-deleted user id ${row.id}`);
      }
    }

    const password = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const admin = await User.create(
      {
        name: DEFAULT_NAME,
        email,
        password,
        role_id: superAdminRole.id,
        force_password_change: true,
        status: 'active',
        failed_login_count: 0,
        locked_until: null,
        two_factor_enabled: false,
        two_factor_secret: null,
        remember_token: null,
        reset_token: null,
        reset_token_expires: null
      },
      { transaction }
    );

    console.log(`Created super admin: ${admin.email} (id ${admin.id})`);
  });

  console.log(`Login with ${email} / ${DEFAULT_PASSWORD}`);
  await sequelize.close();
}

resetAdmin().catch(async (error) => {
  console.error(error);
  await sequelize.close();
  process.exit(1);
});
