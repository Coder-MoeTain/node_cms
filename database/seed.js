const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const {
  sequelize,
  Role,
  Permission,
  User,
  Category,
  Tag,
  Page,
  Menu,
  MenuItem,
  Banner,
  Slider,
  Theme,
  ThemeSetting,
  SiteSetting,
  SecuritySetting,
  WafSetting,
  WafRule
} = require('../models');
const themeLoader = require('../utils/themeLoader');

const permissions = [
  'view_dashboard',
  'manage_posts',
  'create_posts',
  'edit_posts',
  'delete_posts',
  'publish_posts',
  'manage_pages',
  'manage_categories',
  'manage_tags',
  'manage_media',
  'upload_media',
  'manage_menus',
  'manage_banners',
  'manage_sliders',
  'manage_users',
  'manage_roles',
  'manage_themes',
  'manage_comments',
  'manage_messages',
  'manage_plugins',
  'manage_settings',
  'manage_security',
  'manage_waf'
];

const wafSettings = {
  waf_enabled: ['true', 'boolean'],
  waf_mode: ['monitor', 'string'],
  block_sql_injection: ['true', 'boolean'],
  block_xss: ['true', 'boolean'],
  block_path_traversal: ['true', 'boolean'],
  block_command_injection: ['true', 'boolean'],
  block_bad_bots: ['true', 'boolean'],
  block_scanners: ['true', 'boolean'],
  block_cms_probes: ['true', 'boolean'],
  max_risk_score_public: ['50', 'number'],
  max_risk_score_admin: ['40', 'number'],
  max_risk_score: ['50', 'number'],
  log_all_suspicious: ['true', 'boolean'],
  log_all_requests: ['false', 'boolean'],
  log_blocked_only: ['true', 'boolean'],
  admin_protection_enabled: ['true', 'boolean'],
  public_protection_enabled: ['true', 'boolean'],
  auto_block_enabled: ['true', 'boolean'],
  auto_block_threshold: ['5', 'number'],
  auto_block_window_minutes: ['10', 'number'],
  auto_block_duration_minutes: ['60', 'number'],
  trusted_proxy_enabled: ['false', 'boolean'],
  waf_response_message: ['Request blocked by Web Application Firewall.', 'string']
};

const wafRules = [
  ['SQLi UNION SELECT', 'sqli_union_select', 'Detects UNION SELECT probes.', 'sql_injection', '\\bunion\\s+(all\\s+)?select\\b', 'all', 'block', 'critical', 50],
  ['SQLi Boolean OR', 'sqli_or_boolean', 'Detects OR 1=1 style boolean SQL injection.', 'sql_injection', '\\bor\\s+1\\s*=\\s*1\\b', 'all', 'block', 'critical', 45],
  ['SQLi Boolean AND', 'sqli_and_boolean', 'Detects AND 1=1 style boolean SQL injection.', 'sql_injection', '\\band\\s+1\\s*=\\s*1\\b', 'all', 'block', 'high', 35],
  ['SQLi DROP TABLE', 'sqli_drop_table', 'Detects destructive DROP TABLE statements.', 'sql_injection', '\\bdrop\\s+table\\b', 'all', 'block', 'critical', 60],
  ['SQLi Information Schema', 'sqli_information_schema', 'Detects information_schema enumeration.', 'sql_injection', '\\binformation_schema\\b', 'all', 'block', 'high', 35],
  ['SQLi Time Delay', 'sqli_time_delay', 'Detects SLEEP or BENCHMARK SQL timing probes.', 'sql_injection', '\\b(sleep|benchmark)\\s*\\(', 'all', 'block', 'critical', 50],
  ['SQLi File Access', 'sqli_file_access', 'Detects LOAD_FILE or INTO OUTFILE usage.', 'sql_injection', '\\b(load_file|into\\s+outfile)\\b', 'all', 'block', 'critical', 50],
  ['SQLi Comment Abuse', 'sqli_comment_abuse', 'Detects common SQL comment abuse.', 'sql_injection', '(/\\*|\\*/|--\\s|#)', 'query', 'block', 'medium', 20],
  ['XSS Script Tag', 'xss_script_tag', 'Detects script tag injection.', 'xss', '<\\s*/?\\s*script\\b', 'all', 'block', 'critical', 50],
  ['XSS JavaScript URI', 'xss_javascript_uri', 'Detects javascript: URI injection.', 'xss', 'javascript\\s*:', 'all', 'block', 'high', 35],
  ['XSS Event Handler', 'xss_event_handler', 'Detects onerror/onload event handlers.', 'xss', '\\bon(error|load)\\s*=', 'all', 'block', 'high', 35],
  ['XSS Iframe', 'xss_iframe', 'Detects iframe injection attempts.', 'xss', '<\\s*iframe\\b', 'all', 'block', 'medium', 25],
  ['XSS SVG Onload', 'xss_svg_onload', 'Detects SVG onload payloads.', 'xss', '<\\s*svg\\b[^>]*\\bonload\\s*=', 'all', 'block', 'high', 35],
  ['XSS Cookie Theft', 'xss_document_cookie', 'Detects document.cookie access.', 'xss', 'document\\s*\\.\\s*cookie', 'all', 'block', 'high', 35],
  ['XSS Eval Alert', 'xss_eval_alert', 'Detects eval or alert JavaScript payloads.', 'xss', '\\b(eval|alert)\\s*\\(', 'all', 'block', 'medium', 20],
  ['Path Traversal Dots', 'path_traversal_dots', 'Detects ../ and ..\\ traversal.', 'path_traversal', '(\\.\\./|\\.\\.\\\\)', 'all', 'block', 'high', 35],
  ['Path Traversal Encoded', 'path_traversal_encoded', 'Detects encoded dot-dot traversal.', 'path_traversal', '(%2e%2e|%252e%252e)', 'all', 'block', 'high', 35],
  ['Path Sensitive Files', 'path_sensitive_files', 'Detects common OS sensitive file probes.', 'path_traversal', '(/etc/passwd|boot\\.ini|win\\.ini)', 'all', 'block', 'critical', 50],
  ['Command Chaining', 'cmd_chain', 'Detects shell command chaining probes.', 'command_injection', '(;\\s*cat\\b|&&\\s*whoami\\b|\\|\\s*whoami\\b)', 'all', 'block', 'critical', 50],
  ['Command Substitution', 'cmd_substitution', 'Detects backtick or dollar command substitution.', 'command_injection', '(`[^`]+`|\\$\\([^)]*\\))', 'all', 'block', 'high', 35],
  ['Command Shells', 'cmd_shells', 'Detects shell executable references.', 'command_injection', '(/bin/bash|powershell|cmd\\.exe)', 'all', 'block', 'critical', 50],
  ['Scanner User Agent', 'scanner_user_agent', 'Detects common scanner user agents.', 'scanner', '(sqlmap|nikto|nmap|masscan|dirbuster|gobuster|ffuf|wpscan|acunetix|nessus|openvas|burpsuite)', 'user_agent', 'block', 'critical', 60],
  ['Suspicious Dotfile Request', 'file_dotfile_request', 'Detects requests for hidden config repositories.', 'file_attack', '(\\.env|\\.git)(/|$)', 'url', 'block', 'critical', 60],
  ['Suspicious PHP Config Request', 'file_php_config_request', 'Detects common PHP config and info probes.', 'file_attack', '(wp-config\\.php|phpinfo\\.php|config\\.php)$', 'url', 'block', 'high', 35],
  ['Suspicious Database Backup Request', 'file_database_backup_request', 'Detects common database backup file probes.', 'file_attack', '(backup\\.sql|database\\.sql)$', 'url', 'block', 'critical', 50],
  ['CMS Adminer Probe', 'cms_adminer_probe', 'Detects adminer.php probes.', 'cms_probe', 'adminer\\.php', 'url', 'block', 'critical', 50],
  ['Dangerous PHP Upload', 'file_php_upload', 'Detects dangerous PHP upload filenames.', 'file_attack', '\\.(php|phtml)$', 'file_name', 'block', 'critical', 60],
  ['Dangerous Executable Upload', 'file_exe_upload', 'Detects executable upload filenames.', 'file_attack', '\\.(exe|bat|cmd|sh)$', 'file_name', 'block', 'critical', 60],
  ['Dangerous Script Upload', 'file_script_upload', 'Detects server script upload filenames.', 'file_attack', '\\.(jsp|asp|aspx)$', 'file_name', 'block', 'critical', 60]
];

const roles = [
  ['Super Admin', 'super-admin', permissions],
  ['Admin', 'admin', permissions.filter((permission) => permission !== 'manage_roles')],
  [
    'Editor',
    'editor',
    [
      'view_dashboard',
      'manage_posts',
      'create_posts',
      'edit_posts',
      'publish_posts',
      'manage_pages',
      'manage_categories',
      'manage_tags',
      'manage_media',
      'manage_comments'
    ]
  ],
  ['Author', 'author', ['view_dashboard', 'create_posts', 'edit_posts', 'upload_media']],
  ['Subscriber', 'subscriber', []]
];

async function seed({ closeConnection = false } = {}) {
  await sequelize.authenticate();

  const permissionRows = {};
  for (const slug of permissions) {
    const [permission] = await Permission.findOrCreate({
      where: { slug },
      defaults: { name: slug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
    });
    permissionRows[slug] = permission;
  }

  let superAdminRole;
  let authorRole;
  for (const [name, slug, rolePermissions] of roles) {
    const [role] = await Role.findOrCreate({ where: { slug }, defaults: { name } });
    await role.setPermissions(rolePermissions.map((permission) => permissionRows[permission]));
    if (slug === 'super-admin') superAdminRole = role;
    if (slug === 'author') authorRole = role;
  }

  await User.findOrCreate({
    where: { email: 'admin@example.com' },
    defaults: {
      name: 'Super Admin',
      email: 'admin@example.com',
      password: await bcrypt.hash('Admin@12345', 12),
      role_id: superAdminRole.id,
      force_password_change: true,
      status: 'active'
    }
  });

  if (authorRole) {
    await User.findOrCreate({
      where: { email: 'author@example.com' },
      defaults: {
        name: 'Author User',
        email: 'author@example.com',
        password: await bcrypt.hash('Author@12345', 12),
        role_id: authorRole.id,
        status: 'active'
      }
    });
  }

  const categoryDefs = [
    ['news', 'News', 'Official news and press releases.'],
    ['announcements', 'Announcements', 'Public announcements and notices.'],
    ['tenders', 'Tenders', 'Government tender notices.'],
    ['jobs', 'Jobs', 'Job vacancies and career opportunities.'],
    ['documents', 'Documents', 'Policies, reports, and publications.'],
    ['services', 'Services', 'Citizen services and resources.']
  ];
  const categories = {};
  for (const [slug, name, description] of categoryDefs) {
    const [row] = await Category.findOrCreate({ where: { slug }, defaults: { name, description } });
    categories[slug] = row;
  }
  const category = categories.news;
  await Tag.findOrCreate({ where: { slug: 'nodepress' }, defaults: { name: 'NodePress' } });

  await Page.findOrCreate({
    where: { slug: 'about' },
    defaults: {
      title: 'About Us',
      content: '<p>Welcome to the official NodePress government information portal.</p>',
      status: 'published',
      published_at: new Date()
    }
  });
  await Page.findOrCreate({
    where: { slug: 'terms' },
    defaults: {
      title: 'Terms of Use',
      content: '<p>These terms govern use of this official information portal.</p>',
      status: 'published',
      published_at: new Date()
    }
  });
  await Page.findOrCreate({
    where: { slug: 'privacy' },
    defaults: {
      title: 'Privacy Policy',
      content: '<p>How we collect, use, and protect citizen information on this portal.</p>',
      status: 'published',
      published_at: new Date()
    }
  });
  await Page.findOrCreate({
    where: { slug: 'public-holidays' },
    defaults: {
      title: 'Public Holidays',
      content: '<p>National public holiday calendar for the current year.</p>',
      status: 'published',
      published_at: new Date()
    }
  });

  const [headerMenu] = await Menu.findOrCreate({ where: { slug: 'main-menu' }, defaults: { name: 'Main Menu' } });
  const menuItems = [
    ['Home', '/', 1],
    ['Announcements', '/category/announcements', 2],
    ['Services', '/category/services', 3],
    ['Documents', '/category/documents', 4],
    ['Contact', '/contact', 5]
  ];
  for (const [title, url, display_order] of menuItems) {
    await MenuItem.findOrCreate({
      where: { menu_id: headerMenu.id, title },
      defaults: { menu_id: headerMenu.id, title, url, display_order }
    });
  }
  await MenuItem.destroy({
    where: {
      menu_id: headerMenu.id,
      title: { [Op.in]: ['News', 'Tenders', 'Jobs'] }
    }
  });

  const [footerMenu] = await Menu.findOrCreate({
    where: { slug: 'footer-menu' },
    defaults: { name: 'Footer Menu', location: 'footer' }
  });
  const footerItems = [
    ['Mission Home', '/', 1],
    ['Articles', '/blog', 2],
    ['About NodePress', '/page/about', 3],
    ['Contact', '/contact', 4],
    ['Privacy Policy', '/page/privacy', 5],
    ['Terms', '/page/terms', 6]
  ];
  for (const [title, url, display_order] of footerItems) {
    await MenuItem.findOrCreate({
      where: { menu_id: footerMenu.id, title },
      defaults: { menu_id: footerMenu.id, title, url, display_order }
    });
  }

  const [quickServicesMenu] = await Menu.findOrCreate({
    where: { slug: 'quick-services' },
    defaults: { name: 'Quick Services', location: 'header' }
  });
  const quickServiceItems = [
    ['Government Websites', '/blog', 1],
    ['Forms', '/search?q=forms', 2],
    ['Documents', '/category/documents', 3],
    ['Public Holidays', '/page/public-holidays', 4],
    ['Mobile Apps', '#portal-mobile-app', 5],
    ['Contact', '/contact', 6]
  ];
  for (const [title, url, display_order] of quickServiceItems) {
    await MenuItem.findOrCreate({
      where: { menu_id: quickServicesMenu.id, title },
      defaults: { menu_id: quickServicesMenu.id, title, url, display_order, active: true }
    });
  }

  await Banner.findOrCreate({
    where: { title: 'Build and publish faster' },
    defaults: {
      subtitle: 'A modern publishing platform powered by Node.js and MySQL.',
      button_text: 'Read Blog',
      button_link: '/blog',
      display_order: 1
    }
  });

  await Slider.findOrCreate({
    where: { title: 'Welcome to NodePress CMS' },
    defaults: {
      description: 'Manage posts, pages, media, menus, themes, and security from one dashboard.',
      button_text: 'Explore',
      button_url: '/blog',
      display_order: 1
    }
  });

  const themes = themeLoader.discoverThemes();
  for (const item of themes) {
    const manifest = item.manifest;
    await Theme.findOrCreate({
      where: { slug: manifest.slug },
      defaults: {
        name: manifest.name,
        description: manifest.description,
        preview_image: manifest.screenshot || `/themes/${manifest.slug}/screenshot.svg`,
        manifest,
        parent_slug: manifest.parent || null,
        active: manifest.slug === 'government-portal'
      }
    });
    await ThemeSetting.findOrCreate({
      where: { theme_name: manifest.slug },
      defaults: themeLoader.buildThemeSettingDefaults(manifest.slug)
    });
  }

  await Theme.update({ active: false }, { where: {} });
  await Theme.update({ active: true }, { where: { slug: 'government-portal' } });
  await ThemeSetting.update({ active: false }, { where: {} });
  await ThemeSetting.update({ active: true }, { where: { theme_name: 'government-portal' } });

  const { PORTAL_SETTING_DEFINITIONS } = require('../utils/portalSettings');
  const settings = {
    ...Object.fromEntries(Object.entries(PORTAL_SETTING_DEFINITIONS).map(([key, def]) => [key, def.value])),
    admin_email: 'admin@example.com',
    default_post_status: 'draft',
    maintenance_mode: 'false',
    facebook_link: '#',
    youtube_link: '#',
    telegram_link: '#',
    linkedin_link: '#',
    emergency_phone: '+1 (555) 010-9911',
    emergency_email: 'emergency@example.com',
    emergency_hours: '24/7'
  };
  for (const [key, value] of Object.entries(settings)) {
    const group = PORTAL_SETTING_DEFINITIONS[key]?.group || 'general';
    await SiteSetting.findOrCreate({ where: { key }, defaults: { value, group } });
  }

  const securitySettings = {
    login_attempt_limiter: 'true',
    login_max_account_attempts: '5',
    login_lockout_minutes: '15',
    login_max_ip_attempts: '10',
    login_ip_window_minutes: '15',
    login_auto_block_ip_attempts: '25',
    csrf_protection: 'true',
    xss_protection: 'true',
    file_upload_validation: 'true',
    admin_session_timeout: 'true',
    force_strong_password: 'true',
    two_factor_auth: 'false',
    maintenance_mode: 'false'
  };
  for (const [key, value] of Object.entries(securitySettings)) {
    await SecuritySetting.findOrCreate({ where: { key }, defaults: { value, enabled: value === 'true' } });
  }

  for (const [setting_key, [setting_value, setting_type]] of Object.entries(wafSettings)) {
    await WafSetting.findOrCreate({ where: { setting_key }, defaults: { setting_value, setting_type } });
  }

  for (const [name, rule_key, description, category, pattern, target, action, severity, score] of wafRules) {
    await WafRule.findOrCreate({
      where: { rule_key },
      defaults: {
        name,
        description,
        category,
        pattern,
        pattern_type: 'regex',
        target,
        action,
        severity,
        score,
        status: true,
        is_system: true
      }
    });
  }

  console.log('Seed complete. Login with admin@example.com / Admin@12345');
  console.log('Author account: author@example.com / Author@12345');
  if (closeConnection) await sequelize.close();
}

if (require.main === module) {
  seed({ closeConnection: true }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seed };
