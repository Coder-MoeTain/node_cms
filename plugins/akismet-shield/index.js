const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');
const { filterPayload } = require('./spamCheck');

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);

    hooks.register('beforeCommentCreate', async (comment) => filterPayload(comment, settings), 10);

    hooks.register('beforeContactSubmit', async (message) => {
      if (!settingBool(settings.filter_contact, true)) return message;
      return filterPayload(message, settings);
    }, 10);

    hooks.register('dashboardWidgets', () => ({
      title: 'Spam Guard',
      body: settingBool(settings.enabled, true)
        ? `Spam filtering active (<strong>${settingValue(settings, 'strictness', 'normal')}</strong> mode) for comments${settingBool(settings.filter_contact, true) ? ' and contact messages' : ''}.`
        : 'Spam filtering is disabled in plugin settings.'
    }));
  }
};
