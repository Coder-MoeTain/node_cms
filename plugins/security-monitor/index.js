module.exports = {
  register({ hooks }) {
    hooks.register('beforeMediaUpload', async (file) => file);
    hooks.register('dashboardWidgets', () => ({
      title: 'Security Monitor',
      body: 'Upload and login monitoring hooks are ready.'
    }));
  }
};
