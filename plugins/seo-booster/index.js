module.exports = {
  register({ hooks }) {
    hooks.register('publicHead', () => [
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="generator" content="NodePress CMS + SEO Booster">'
    ]);
  }
};
