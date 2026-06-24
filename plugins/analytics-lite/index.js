const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');
const { buildDeferredLoader } = require('../../utils/consentScript');

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

    const hookName = footerPosition === 'head' ? 'publicHead' : 'publicFooter';
    hooks.register(hookName, ({ req }) => {
      if (!trackAdmin && req.path.startsWith('/admin')) return null;
      return renderTracking();
    });

    hooks.register('dashboardWidgets', () => ({
      title: 'Analytics Lite',
      body: trackingId
        ? `GA4 tracking active for <code>${trackingId}</code>${respectConsent ? ' · waits for cookie consent' : ''}${debugMode ? ' · debug on' : ''}.`
        : 'Add a GA4 Measurement ID in plugin settings to start tracking.'
    }));
  }
};
