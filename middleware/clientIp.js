const { resolveRequestIpAsync } = require('../utils/loginSessionHelper');

async function clientIpMiddleware(req, res, next) {
  try {
    req.clientIp = await resolveRequestIpAsync(req);
    res.locals.clientIp = req.clientIp;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { clientIpMiddleware };
