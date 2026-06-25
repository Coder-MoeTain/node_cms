const bcrypt = require('bcrypt');
const crypto = require('crypto');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { User, Role, Permission, LoginAttempt, ActivityLog, PasswordResetToken } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const loginBruteForce = require('../../utils/loginBruteForce');
const { sendPasswordResetEmail } = require('../../utils/mailer');

function loginForm(req, res) {
  res.render('admin/auth/login', {
    title: 'Admin Login',
    loginEmail: req.query.email || ''
  });
}

function loginRedirect(res, email) {
  const q = email ? `?email=${encodeURIComponent(email)}` : '';
  return res.redirect(`/admin/login${q}`);
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return loginRedirect(res, req.body.email);
    }

    const { email, password } = req.body;
    const bruteForce = await loginBruteForce.getBruteForceSettings();
    const user = await User.findOne({
      where: { email, status: 'active' },
      include: [{ model: Role, include: [Permission] }]
    });
    if (user?.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.max(1, Math.ceil((user.locked_until - Date.now()) / 60000));
      req.flash('error', `This account is temporarily locked. Try again in ${minutesLeft} minute(s).`);
      return loginRedirect(res, email);
    }
    const valid = user && (await bcrypt.compare(password, user.password));

    try {
      await LoginAttempt.create({
        email,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: Boolean(valid),
        reason: valid ? 'success' : 'invalid_credentials'
      });
    } catch {
      // Login attempt logging should not block authentication flow.
    }

    if (!valid) {
      if (user) {
        const failedCount = (user.failed_login_count || 0) + 1;
        await user.update({
          failed_login_count: failedCount,
          locked_until: loginBruteForce.accountLockUntil(
            failedCount,
            bruteForce.lockoutMinutes,
            bruteForce.maxAccountAttempts
          )
        });
      }
      await loginBruteForce.maybeAutoBlockIp(req);
      req.flash('error', 'Invalid email or password.');
      return loginRedirect(res, email);
    }

    if (user.two_factor_enabled) {
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: req.body.totp,
        window: 1
      });
      if (!verified) {
        req.flash('error', 'A valid two-factor code is required.');
        return loginRedirect(res, email);
      }
    }

    const permissions = user.Role?.Permissions?.map((permission) => permission.slug) || [];
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.Role?.slug,
      roleName: user.Role?.name,
      permissions,
      forcePasswordChange: user.force_password_change
    };
    req.session.lastActivity = Date.now();

    await user.update({ last_login: new Date(), failed_login_count: 0, locked_until: null });
    await ActivityLog.create({
      user_id: user.id,
      action: 'Logged in',
      entity_type: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    await pluginLoader.doAction('afterUserLogin', user, { req, res });

    if (user.force_password_change) {
      req.flash('error', 'Please change the default password.');
      return res.redirect('/admin/profile');
    }

    if (user.Role?.slug === 'subscriber') {
      req.flash('success', 'You are signed in.');
      return res.redirect('/');
    }

    return res.redirect('/admin');
  } catch (error) {
    return next(error);
  }
}

function forgotPasswordForm(req, res) {
  res.render('admin/auth/forgot-password', { title: 'Forgot Password' });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function forgotPassword(req, res, next) {
  try {
    const user = await User.findOne({ where: { email: req.body.email, status: 'active' } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await PasswordResetToken.create({
        user_id: user.id,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });
      const mailResult = await sendPasswordResetEmail(user, token);
      if (process.env.NODE_ENV !== 'production' && !mailResult.sent) {
        req.flash('success', `Development reset link: /admin/reset-password?token=${token}`);
      }
    }
    req.flash('success', 'If that email exists, a reset link has been generated.');
    return res.redirect('/admin/login');
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const token = req.body.token;
    const row = token ? await PasswordResetToken.findOne({
      where: {
        token_hash: hashToken(token),
        used_at: null,
        expires_at: { [Op.gt]: new Date() }
      }
    }) : null;
    if (!row || !req.body.password || req.body.password.length < 10) {
      req.flash('error', 'Reset token is invalid or password is too short.');
      return res.redirect('/admin/reset-password');
    }
    const user = await User.findByPk(row.user_id);
    await user.update({ password: await bcrypt.hash(req.body.password, 12), force_password_change: false, failed_login_count: 0, locked_until: null });
    await row.update({ used_at: new Date() });
    req.flash('success', 'Password reset complete. You can log in now.');
    return res.redirect('/admin/login');
  } catch (error) {
    return next(error);
  }
}

function resetPasswordForm(req, res) {
  res.render('admin/auth/reset-password', { title: 'Reset Password', token: req.query.token || '' });
}

async function profile(req, res, next) {
  try {
    const user = await User.findByPk(req.session.user.id, { include: [Role] });
    return res.render('admin/auth/profile', { title: 'Profile Settings', user });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = await User.findByPk(req.session.user.id);
    const payload = { name: req.body.name, email: req.body.email };
    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 12);
      payload.force_password_change = false;
    }
    await user.update(payload);
    req.session.user.name = user.name;
    req.session.user.email = user.email;
    req.session.user.forcePasswordChange = false;
    req.flash('success', 'Profile updated.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

async function twoFactorForm(req, res, next) {
  try {
    const user = await User.findByPk(req.session.user.id);
    let qrCode = null;
    let secret = user.two_factor_secret;
    if (!user.two_factor_enabled) {
      const generated = speakeasy.generateSecret({ name: `NodePress CMS (${user.email})` });
      secret = generated.base32;
      req.session.pendingTwoFactorSecret = secret;
      qrCode = await qrcode.toDataURL(generated.otpauth_url);
    }
    return res.render('admin/auth/2fa', { title: 'Two-Factor Authentication', user, qrCode, secret });
  } catch (error) {
    return next(error);
  }
}

async function enableTwoFactor(req, res, next) {
  try {
    const user = await User.findByPk(req.session.user.id);
    const secret = req.session.pendingTwoFactorSecret;
    const verified = secret && speakeasy.totp.verify({ secret, encoding: 'base32', token: req.body.token, window: 1 });
    if (!verified) {
      req.flash('error', 'Invalid 2FA code.');
      return res.redirect('/admin/profile/2fa');
    }
    await user.update({ two_factor_enabled: true, two_factor_secret: secret });
    delete req.session.pendingTwoFactorSecret;
    req.flash('success', 'Two-factor authentication enabled.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

async function disableTwoFactor(req, res, next) {
  try {
    const user = await User.findByPk(req.session.user.id);
    await user.update({ two_factor_enabled: false, two_factor_secret: null });
    req.flash('success', 'Two-factor authentication disabled.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
}

module.exports = {
  loginForm,
  login,
  forgotPasswordForm,
  forgotPassword,
  resetPasswordForm,
  resetPassword,
  profile,
  updateProfile,
  twoFactorForm,
  enableTwoFactor,
  disableTwoFactor,
  logout
};
