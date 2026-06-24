const {
  resolvePortalConfig,
  parseBlock,
  stripManagedBlocks,
  MYANMAR_PORTAL_DEFAULTS,
  buildPortalConfigBlock
} = require('../utils/portalConfig');

describe('portalConfig', () => {
  test('parses np-portal-config JSON block from custom_css', () => {
    const css = `/* np-portal-config */\n${JSON.stringify({ homepage: { hero: false } })}`;
    const parsed = parseBlock(css, 'np-portal-config');
    expect(parsed.homepage.hero).toBe(false);
  });

  test('merges myanmar-portal preset when header_layout is portal', () => {
    const config = resolvePortalConfig({
      header_layout: 'portal',
      custom_css: buildPortalConfigBlock({ homepage: { statistics: false } })
    });
    expect(config.header.layout).toBe('portal');
    expect(config.nav.megaMenu).toBe(true);
    expect(config.homepage.statistics).toBe(false);
    expect(config.homepage.sectionNav).toBe(true);
  });

  test('stripManagedBlocks removes portal config and theme vars', () => {
    const css = `/* np-theme-vars */\n:root { --site-link: #000; }\n${buildPortalConfigBlock(MYANMAR_PORTAL_DEFAULTS)}`;
    const stripped = stripManagedBlocks(css);
    expect(stripped).not.toContain('np-portal-config');
    expect(stripped).not.toContain('np-theme-vars');
  });
});
