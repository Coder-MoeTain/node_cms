const { sequelize } = require('../../models');
const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');
const { buildDeferredLoader } = require('../../utils/consentScript');

async function recordPageView(req) {
  const path = String(req.path || '/').slice(0, 512);
  const userAgent = String(req.get('user-agent') || '').slice(0, 512);
  await sequelize.query(
    'INSERT INTO plugin_analytics_page_views (path, user_agent, viewed_at) VALUES (?, ?, NOW())',
    { replacements: [path, userAgent] }
  );
}

async function countRecentPageViews(days = 7) {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) AS total FROM plugin_analytics_page_views WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)',
    { replacements: [days] }
  );
  return Number(rows?.[0]?.total || 0);
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const trackingId = settingValue(settings, 'tracking_id').trim();
    const anonymize = settingBool(settings.anonymize_ip, true);
    const trackAdmin = settingBool(settings.track_admin, false);
    const debugMode = settingBool(settings.debug_mode, false);
    const respectConsent = settingBool(settings.respect_cookie_consent, true);
    const customScript = settingValue(settings, 'custom_script');
    const footerPosition = settingValue(settings, 'footer_position', 'footer');
    const localPageViews = settingBool(settings.local_page_views, true);

    const buildGaScript = () => {
      if (!trackingId) return '';
      const debug = debugMode ? ',{debug_mode:true}' : '';
      return [
        `<script async src="https://www.googletagmanager.com/gtag/js?id=${trackingId}"></script>`,
        `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${trackingId}',{anonymize_ip:${anonymize}}${debug});</script>`
      ].join('\n');
    };

    const renderTracking = () => {
      const parts = [];
      if (trackingId) parts.push(buildGaScript());
      if (customScript) parts.push(customScript);
      if (!parts.length) return null;
      const html = parts.join('\n');
      return respectConsent ? buildDeferredLoader(html) : html;
    };

    if (localPageViews) {
      hooks.register('publicFooter', async ({ req }) => {
        if (!trackAdmin && req.path.startsWith('/admin')) return null;
        try {
          await recordPageView(req);
        } catch {
          // table may not exist until plugin migration runs
        }
        return null;
      }, 1);
    }

    const hookName = footerPosition === 'head' ? 'publicHead' : 'publicFooter';
    hooks.register(hookName, ({ req }) => {
      if (!trackAdmin && req.path.startsWith('/admin')) return null;
      return renderTracking();
    });

    hooks.register('dashboardWidgets', async () => {
      let localCount = null;
      if (localPageViews) {
        try {
          localCount = await countRecentPageViews(7);
        } catch {
          localCount = null;
        }
      }
      const localLine = localCount != null
        ? `<br>Local page views (7 days): <strong>${localCount}</strong>`
        : '';
      return {
        title: 'Analytics Lite',
        body: trackingId
          ? `GA4 tracking active for <code>${trackingId}</code>${respectConsent ? ' · waits for cookie consent' : ''}${debugMode ? ' · debug on' : ''}.${localLine}`
          : `Add a GA4 Measurement ID in plugin settings to start tracking.${localLine || ' Local page view logging is enabled when migrations have run.'}`
      };
    });
  },
  recordPageView,
  countRecentPageViews
};
