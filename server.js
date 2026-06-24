const path = require('path');
const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const compression = require('compression');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');

const appConfig = require('./config/app');
const pkg = require('./package.json');
const sequelize = require('./config/database');
const models = require('./models');
const { applySecurityMiddleware, apiLimiter } = require('./middleware/security');
const { csrfProtection } = require('./middleware/csrf');
const { loadSiteContext } = require('./middleware/siteContext');
const { wafMiddleware } = require('./middleware/waf');
const errorHandler = require('./middleware/errorHandler');
const notFoundMiddleware = require('./middleware/notFound');
const policy = require('./utils/policy');
const pluginLoader = require('./utils/pluginLoader');

const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const { apiAuth } = require('./middleware/apiAuth');

const app = express();
const sessionStore = new SequelizeStore({ db: sequelize });

if (appConfig.env === 'production' && appConfig.sessionSecret === 'change-this-long-random-secret') {
  throw new Error('SESSION_SECRET must be set to a strong value in production.');
}

app.set('trust proxy', appConfig.trustProxy);
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views'), __dirname]);
app.set('layout', false);

app.use(compression());
app.use(morgan(appConfig.env === 'development' ? 'dev' : 'combined'));
applySecurityMiddleware(app);
app.use('/vendor/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));
app.use('/vendor/bootstrap-icons', express.static(path.join(__dirname, 'node_modules', 'bootstrap-icons')));
app.use('/themes', express.static(path.join(__dirname, 'themes')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(healthRoutes);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

app.use(
  session({
    name: appConfig.sessionName,
    secret: appConfig.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.env === 'production',
      maxAge: appConfig.sessionMaxAge
    }
  })
);

app.use(flash());
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.npVersion = pkg.version;
  res.locals.currentUser = req.session.user || null;
  res.locals.can = (permission) => policy.can(req.session.user, permission);
  res.locals.canAny = (permissions) => policy.hasAnyPermission(req.session.user, permissions);
  res.locals.canManageResource = (resource, action, record = null) => policy.canManageResource(req.session.user, resource, action, record);
  res.locals.currentPath = req.originalUrl || req.path;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.formData = {};
  next();
});
app.use(loadSiteContext);
app.use(wafMiddleware);
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin') && res.locals.siteSettings.maintenance_mode === 'true') {
    return res.status(503).render('errors/maintenance', { title: 'Maintenance' });
  }
  return next();
});

app.use('/admin', adminRoutes);
app.use('/api', apiLimiter, apiAuth, apiRoutes);
app.use('/', publicRoutes);

app.use(notFoundMiddleware);

app.use(errorHandler);

async function start() {
  try {
    await sequelize.authenticate();
    await sessionStore.sync();
    await pluginLoader.loadActivePlugins(app);
    app.listen(appConfig.port, () => {
      console.log(`${appConfig.name} running at ${appConfig.url}`);
    });
  } catch (error) {
    console.error('Unable to start NodePress CMS:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, sequelize, models, start };
