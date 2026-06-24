const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { User, Role, Permission, LoginAttempt, ActivityLog } = require('../../models');

function loginForm(req, res) {
  res.render('admin/auth/login', { title: 'Admin Login' });
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/admin/login');
    }

    const { email, password } = req.body;
    const user = await User.findOne({
      where: { email, status: 'active' },
      include: [{ model: Role, include: [Permission] }]
    });
    const valid = user && (await bcrypt.compare(password, user.password));

    await LoginAttempt.create({
      email,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      success: Boolean(valid),
      reason: valid ? 'success' : 'invalid_credentials'
    });

    if (!valid) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/admin/login');
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

    await user.update({ last_login: new Date() });
    await ActivityLog.create({
      user_id: user.id,
      action: 'Logged in',
      entity_type: 'auth',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    if (user.force_password_change) {
      req.flash('error', 'Please change the default password.');
      return res.redirect('/admin/profile');
    }
    return res.redirect('/admin');
  } catch (error) {
    return next(error);
  }
}

function forgotPasswordForm(req, res) {
  res.render('admin/auth/forgot-password', { title: 'Forgot Password' });
}

async function forgotPassword(req, res) {
  req.flash('success', 'If that email exists, a reset link would be sent by the mail adapter.');
  return res.redirect('/admin/login');
}

function resetPasswordForm(req, res) {
  res.render('admin/auth/reset-password', { title: 'Reset Password', token: req.query.token || '' });
}

async function resetPassword(req, res) {
  req.flash('success', 'Password reset endpoint is ready for mail-token integration.');
  return res.redirect('/admin/login');
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
  logout
};
