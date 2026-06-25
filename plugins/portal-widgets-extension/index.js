const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const showCitizenServices = settingBool(settings.show_citizen_services, true);
    const footerNotice = settingValue(settings, 'footer_notice');

    hooks.addAction('adminMenuItems', () => ({
      label: 'Portal Widgets',
      href: '/admin/plugins/portal-widgets-extension/settings',
      icon: 'bi-grid-3x3-gap'
    }), 20);

    hooks.register('dashboardWidgets', () => ({
      title: 'Portal Widgets',
      body: showCitizenServices ? 'Citizen services on' : 'Citizen services off'
    }), 15);

    hooks.addFilter('beforePageRender', (locals) => {
      if (!locals || typeof locals !== 'object') return locals;
      return {
        ...locals,
        portalWidgetExtension: {
          citizenServices: showCitizenServices
        }
      };
    }, 10);

    hooks.register('publicFooter', () => {
      const parts = [];
      if (footerNotice) {
        parts.push(`<div class="portal-widget-extension-notice small text-center text-muted py-2">${escapeHtml(footerNotice)}</div>`);
      }
      return parts.length ? parts.join('\n') : null;
    }, 25);
  }
};
