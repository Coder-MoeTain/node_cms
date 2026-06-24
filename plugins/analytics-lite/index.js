module.exports = {
  register({ hooks }) {
    hooks.register('publicFooter', () => '<script>window.nodepressAnalytics={enabled:true};</script>');
    hooks.register('dashboardWidgets', () => ({
      title: 'Analytics Lite',
      body: 'Analytics hooks are active. Connect a provider in plugin settings.'
    }));
  }
};
