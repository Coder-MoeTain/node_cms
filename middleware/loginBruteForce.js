const { loginLimiter } = require('./security');
const loginBruteForce = require('../utils/loginBruteForce');
const adminLoginPath = require('../utils/adminLoginPath');

async function loginBruteForceGuard(req, res, next) {
  try {
    const settings = await loginBruteForce.getBruteForceSettings();
    if (!settings.enabled) {
      return next();
    }

    const ipCheck = await loginBruteForce.isIpTemporarilyBlocked(req);
    if (ipCheck.blocked) {
      req.flash(
        'error',
        `Too many failed login attempts from your IP address. Please wait ${ipCheck.retryAfterMinutes} minutes before trying again.`
      );
      return res.redirect(await adminLoginPath.getLoginUrl());
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function conditionalLoginLimiter(req, res, next) {
  try {
    const settings = await loginBruteForce.getBruteForceSettings();
    if (!settings.enabled) {
      return next();
    }
    return loginLimiter(req, res, next);
  } catch (error) {
    return next(error);
  }
}

module.exports = { loginBruteForceGuard, conditionalLoginLimiter };
