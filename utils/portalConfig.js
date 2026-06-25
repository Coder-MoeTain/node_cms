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
    sectionNav: false,
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

const DESIGN_TOKEN_PRESETS = {
  radius: {
    compact: { sm: '6px', md: '10px', lg: '16px' },
    default: { sm: '8px', md: '14px', lg: '22px' },
    rounded: { sm: '12px', md: '18px', lg: '28px' }
  },
  shadow: {
    none: {
      sm: 'none',
      md: 'none',
      lg: 'none'
    },
    soft: {
      sm: '0 4px 12px rgba(15, 23, 42, 0.06)',
      md: '0 12px 30px rgba(15, 23, 42, 0.10)',
      lg: '0 20px 40px rgba(15, 23, 42, 0.12)'
    },
    medium: {
      sm: '0 6px 16px rgba(15, 23, 42, 0.08)',
      md: '0 16px 36px rgba(15, 23, 42, 0.12)',
      lg: '0 24px 48px rgba(15, 23, 42, 0.14)'
    },
    strong: {
      sm: '0 8px 20px rgba(15, 23, 42, 0.12)',
      md: '0 20px 44px rgba(15, 23, 42, 0.16)',
      lg: '0 28px 56px rgba(15, 23, 42, 0.18)'
    }
  },
  spacing: {
    compact: { section: '2rem', sectionMobile: '1.5rem' },
    default: { section: '3.5rem', sectionMobile: '2rem' },
    spacious: { section: '5rem', sectionMobile: '3rem' }
  }
};

function inferDesignPreset(group, value) {
  const presets = DESIGN_TOKEN_PRESETS[group] || {};
  for (const [name, preset] of Object.entries(presets)) {
    if (group === 'radius' && preset.md === value) return name;
    if (group === 'shadow' && preset.md === value) return name;
    if (group === 'spacing' && preset.section === value) return name;
  }
  return 'default';
}

function resolveDesignTokenVars(presets = {}) {
  const radius = DESIGN_TOKEN_PRESETS.radius[presets.radius] || DESIGN_TOKEN_PRESETS.radius.default;
  const shadow = DESIGN_TOKEN_PRESETS.shadow[presets.shadow] || DESIGN_TOKEN_PRESETS.shadow.soft;
  const spacing = DESIGN_TOKEN_PRESETS.spacing[presets.spacing] || DESIGN_TOKEN_PRESETS.spacing.default;
  return {
    radiusSm: radius.sm,
    radiusMd: radius.md,
    radiusLg: radius.lg,
    shadowSm: shadow.sm,
    shadowMd: shadow.md,
    shadowLg: shadow.lg,
    sectionPad: spacing.section,
    sectionPadMobile: spacing.sectionMobile
  };
}

function parseDesignTokens(css) {
  const defaults = {
    radius: 'default',
    shadow: 'soft',
    spacing: 'default',
    vars: resolveDesignTokenVars({ radius: 'default', shadow: 'soft', spacing: 'default' })
  };
  if (!css) return defaults;
  const match = css.match(/\/\* np-design-tokens \*\/[\s\S]*?:root\s*\{([^}]+)\}/i);
  if (!match) return defaults;
  const body = match[1];
  const read = (name) => {
    const m = body.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const radiusMd = read('site-radius-md');
  const shadowMd = read('site-shadow-md');
  const sectionPad = read('site-section-pad');
  const radius = inferDesignPreset('radius', radiusMd);
  const shadow = inferDesignPreset('shadow', shadowMd);
  const spacing = inferDesignPreset('spacing', sectionPad);
  return {
    radius,
    shadow,
    spacing,
    vars: resolveDesignTokenVars({ radius, shadow, spacing })
  };
}

function buildDesignTokensBlock(presets = {}) {
  const vars = resolveDesignTokenVars(presets);
  return `/* np-design-tokens */
:root {
  --site-radius-sm: ${vars.radiusSm};
  --site-radius-md: ${vars.radiusMd};
  --site-radius-lg: ${vars.radiusLg};
  --site-shadow-sm: ${vars.shadowSm};
  --site-shadow-md: ${vars.shadowMd};
  --site-shadow-lg: ${vars.shadowLg};
  --site-section-pad: ${vars.sectionPad};
  --site-section-pad-mobile: ${vars.sectionPadMobile};
}`;
}

function stripManagedBlocks(css) {
  if (!css) return '';
  let out = css.replace(/\/\* np-theme-vars \*\/[\s\S]*?\}\s*/g, '');
  out = out.replace(/\/\* np-design-tokens \*\/[\s\S]*?\}\s*/g, '');
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
  DESIGN_TOKEN_PRESETS,
  parseBlock,
  parseThemeVars,
  parseDesignTokens,
  buildDesignTokensBlock,
  resolveDesignTokenVars,
  stripManagedBlocks,
  resolvePortalConfig,
  resolveThemePreset,
  buildPortalConfigBlock
};
