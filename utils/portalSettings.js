/**
 * Portal-related site_settings keys with defaults and admin grouping.
 */
const PORTAL_SETTING_DEFINITIONS = {
  site_title: { value: 'NodePress CMS', group: 'general', label: 'Site title' },
  site_tagline: { value: 'Official information portal powered by NodePress', group: 'portal', label: 'Site tagline' },
  site_location: { value: 'Nay Pyi Taw, MM', group: 'portal', label: 'Site location' },
  posts_per_page: { value: '6', group: 'general', label: 'Posts per page' },
  contact_email: { value: 'contact@example.com', group: 'contact', label: 'Contact email' },
  contact_phone: { value: '+95 67 409 000', group: 'contact', label: 'Contact phone' },
  contact_address: { value: 'Nay Pyi Taw, Myanmar', group: 'contact', label: 'Contact address' },
  emergency_ambulance: { value: '192', group: 'emergency', label: 'Ambulance' },
  emergency_hospital: { value: '192', group: 'emergency', label: 'Hospitals' },
  emergency_covid: { value: '2019', group: 'emergency', label: 'Covid-19 call center' },
  emergency_fire: { value: '191', group: 'emergency', label: 'Fire station' },
  emergency_police: { value: '199', group: 'emergency', label: 'Police station' },
  emergency_highway: { value: '1880', group: 'emergency', label: 'Highway police' },
  stat_users: { value: '1,240', group: 'portal_stats', label: 'Registered users' },
  stat_visitors: { value: '85,420', group: 'portal_stats', label: 'Visitors' },
  stat_discussions: { value: '320', group: 'portal_stats', label: 'Discussions' },
  stat_polls: { value: '48', group: 'portal_stats', label: 'Polls & surveys' },
  stat_blogs: { value: '12', group: 'portal_stats', label: 'Blogs' },
  stat_events: { value: '6', group: 'portal_stats', label: 'Upcoming events' },
  stat_apps: { value: '8', group: 'portal_stats', label: 'Mobile apps' },
  app_store_link: { value: '/contact', group: 'portal_apps', label: 'App Store link' },
  play_store_link: { value: '/contact', group: 'portal_apps', label: 'Google Play link' },
  site_logo: { value: '', group: 'branding', label: 'Site logo' },
  favicon: { value: '', group: 'branding', label: 'Favicon' }
};

const SETTING_GROUP_LABELS = {
  general: 'General',
  portal: 'Portal identity',
  contact: 'Contact information',
  emergency: 'Emergency hotlines',
  portal_stats: 'Portal statistics',
  portal_apps: 'Mobile applications',
  branding: 'Branding'
};

const SETTING_GROUP_ORDER = ['general', 'portal', 'contact', 'emergency', 'portal_stats', 'portal_apps', 'branding'];

function getSettingGroup(key) {
  return PORTAL_SETTING_DEFINITIONS[key]?.group || 'general';
}

async function ensurePortalSettings(SiteSetting) {
  for (const [key, def] of Object.entries(PORTAL_SETTING_DEFINITIONS)) {
    await SiteSetting.findOrCreate({
      where: { key },
      defaults: { value: def.value, group: def.group }
    });
  }
}

module.exports = {
  PORTAL_SETTING_DEFINITIONS,
  SETTING_GROUP_LABELS,
  SETTING_GROUP_ORDER,
  getSettingGroup,
  ensurePortalSettings
};
