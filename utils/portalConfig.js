const DEFAULT_PORTAL_CONFIG = {
  preset: 'classic-blue',
  header: {
    showUtilityBar: true,
    showFontControls: true,
    showLanguageSwitcher: true,
    showLoginLinks: true,
    showSearch: true,
    layout: 'standard'
  },
  nav: {
    megaMenu: false,
    sticky: true,
    style: 'simple'
  },
  homepage: {
    hero: true,
    quickLinks: true,
    emergency: false,
    latestNews: true,
    announcements: true,
    tendersJobs: true,
    mediaGallery: true,
    hotNews: true,
    subscribe: true,
    statistics: true,
    mobileApp: true,
    quickServices: true,
    sectionNav: false,
    announcementTicker: false
  },
  widgets: {
    cardStyle: 'bordered'
  }
};

const MYANMAR_PORTAL_DEFAULTS = {
  preset: 'myanmar-portal',
  header: {
    showUtilityBar: true,
    showFontControls: true,
    showLanguageSwitcher: true,
    showLoginLinks: true,
    showSearch: true,
    layout: 'portal'
  },
  nav: {
    megaMenu: true,
    sticky: true,
    style: 'portal'
  },
  homepage: {
    hero: true,
    quickLinks: true,
    emergency: false,
    latestNews: true,
    announcements: true,
    tendersJobs: true,
    mediaGallery: true,
    hotNews: true,
    subscribe: true,
    statistics: true,
    mobileApp: true,
    quickServices: true,
    sectionNav: true,
    announcementTicker: true
  },
  widgets: {
    cardStyle: 'shadow'
  }
};

function parseBlock(css, marker) {
  if (!css || typeof css !== 'string') return null;
  const token = `/* ${marker} */`;
  const start = css.indexOf(token);
  if (start === -1) return null;
  const after = css.slice(start + token.length).trimStart();
  if (!after.startsWith('{')) return null;
  let depth = 0;
  for (let i = 0; i < after.length; i += 1) {
    if (after[i] === '{') depth += 1;
    if (after[i] === '}') depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(after.slice(0, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function parseThemeVars(css) {
  const defaults = {
    link: null,
    button: null,
    accent: null,
    card: null,
    footer: null,
    muted: null,
    border: null
  };
  if (!css) return defaults;
  const match = css.match(/\/\* np-theme-vars \*\/[\s\S]*?:root\s*\{([^}]+)\}/i);
  if (!match) return defaults;
  const body = match[1];
  const read = (name) => {
    const m = body.match(new RegExp(`--${name}\\s*:\\s*([^;\\s]+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  return {
    link: read('site-link'),
    button: read('site-button'),
    accent: read('site-accent'),
    card: read('site-card'),
    footer: read('site-footer-bg'),
    muted: read('site-muted'),
    border: read('site-border')
  };
}

function stripManagedBlocks(css) {
  if (!css) return '';
  let out = css.replace(/\/\* np-theme-vars \*\/[\s\S]*?\}\s*/g, '');
  const token = '/* np-portal-config */';
  const start = out.indexOf(token);
  if (start !== -1) {
    const after = out.slice(start + token.length).trimStart();
    if (after.startsWith('{')) {
      let depth = 0;
      let end = 0;
      for (let i = 0; i < after.length; i += 1) {
        if (after[i] === '{') depth += 1;
        if (after[i] === '}') depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
      out = out.slice(0, start) + after.slice(end);
    }
  }
  return out.trim();
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      out[key] = deepMerge(base[key] || {}, patch[key]);
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}

function resolvePortalConfig(theme = {}) {
  const customCss = theme.custom_css || '';
  const parsed = parseBlock(customCss, 'np-portal-config') || {};
  let config = deepMerge(DEFAULT_PORTAL_CONFIG, parsed);

  if (theme.header_layout === 'portal') {
    config = deepMerge(config, MYANMAR_PORTAL_DEFAULTS);
    config = deepMerge(config, parsed);
  }

  if (parsed.preset === 'myanmar-portal' || config.preset === 'myanmar-portal') {
    config = deepMerge(MYANMAR_PORTAL_DEFAULTS, parsed);
  }

  return config;
}

function resolveThemePreset(theme = {}, portalConfig = {}) {
  const preset = portalConfig.preset || theme.theme_preset || 'classic-blue';
  return preset === 'wordpress-blue' ? 'classic-blue' : preset;
}

function buildPortalConfigBlock(config) {
  return `/* np-portal-config */\n${JSON.stringify(config, null, 2)}`;
}

module.exports = {
  DEFAULT_PORTAL_CONFIG,
  MYANMAR_PORTAL_DEFAULTS,
  parseBlock,
  parseThemeVars,
  stripManagedBlocks,
  resolvePortalConfig,
  resolveThemePreset,
  buildPortalConfigBlock
};
