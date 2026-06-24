const bcrypt = require('bcrypt');
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
  SecuritySetting
} = require('../models');

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
  'manage_menus',
  'manage_banners',
  'manage_sliders',
  'manage_users',
  'manage_roles',
  'manage_themes',
  'manage_comments',
  'manage_settings',
  'manage_security'
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
  ['Author', 'author', ['view_dashboard', 'create_posts', 'edit_posts', 'manage_media']],
  ['Subscriber', 'subscriber', []]
];

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const permissionRows = {};
  for (const slug of permissions) {
    const [permission] = await Permission.findOrCreate({
      where: { slug },
      defaults: { name: slug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
    });
    permissionRows[slug] = permission;
  }

  let superAdminRole;
  for (const [name, slug, rolePermissions] of roles) {
    const [role] = await Role.findOrCreate({ where: { slug }, defaults: { name } });
    await role.setPermissions(rolePermissions.map((permission) => permissionRows[permission]));
    if (slug === 'super-admin') superAdminRole = role;
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

  const [category] = await Category.findOrCreate({
    where: { slug: 'news' },
    defaults: { name: 'News', description: 'Latest articles and updates.' }
  });
  await Tag.findOrCreate({ where: { slug: 'nodepress' }, defaults: { name: 'NodePress' } });

  await Page.findOrCreate({
    where: { slug: 'about' },
    defaults: {
      title: 'About Us',
      content: '<p>Welcome to NodePress CMS, a customizable blog platform.</p>',
      status: 'published',
      published_at: new Date()
    }
  });

  const [headerMenu] = await Menu.findOrCreate({ where: { slug: 'main-menu' }, defaults: { name: 'Main Menu' } });
  const menuItems = [
    ['Home', '/', 1],
    ['Blog', '/blog', 2],
    ['About', '/page/about', 3],
    ['Contact', '/contact', 4]
  ];
  for (const [title, url, display_order] of menuItems) {
    await MenuItem.findOrCreate({
      where: { menu_id: headerMenu.id, title },
      defaults: { menu_id: headerMenu.id, title, url, display_order }
    });
  }
  const blogMenuItem = await MenuItem.findOne({ where: { menu_id: headerMenu.id, title: 'Blog' } });
  if (blogMenuItem) {
    await MenuItem.findOrCreate({
      where: { menu_id: headerMenu.id, title: 'News Archive' },
      defaults: { menu_id: headerMenu.id, parent_id: blogMenuItem.id, title: 'News Archive', url: '/category/news', display_order: 1 }
    });
  }

  const [footerMenu] = await Menu.findOrCreate({
    where: { slug: 'footer-menu' },
    defaults: { name: 'Footer Menu', location: 'footer' }
  });
  const footerItems = [
    ['Mission Home', '/', 1],
    ['Articles', '/blog', 2],
    ['About NodePress', '/page/about', 3],
    ['Contact', '/contact', 4],
    ['Privacy Policy', '/page/privacy-policy', 5],
    ['Terms', '/page/terms-and-conditions', 6]
  ];
  for (const [title, url, display_order] of footerItems) {
    await MenuItem.findOrCreate({
      where: { menu_id: footerMenu.id, title },
      defaults: { menu_id: footerMenu.id, title, url, display_order }
    });
  }

  await Banner.findOrCreate({
    where: { title: 'Build and publish faster' },
    defaults: {
      subtitle: 'A WordPress-like CMS powered by Node.js and MySQL.',
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

  const themes = [
    ['Classic Blog Theme', 'classic-blog'],
    ['Modern News Theme', 'modern-news'],
    ['Minimal Personal Blog Theme', 'minimal-personal']
  ];
  for (const [name, slug] of themes) {
    await Theme.findOrCreate({ where: { slug }, defaults: { name, active: slug === 'classic-blog' } });
  }

  await ThemeSetting.findOrCreate({ where: { theme_name: 'classic-blog' }, defaults: { active: true } });

  const settings = {
    site_title: 'NodePress CMS',
    site_tagline: 'A modern blog CMS for Node.js',
    site_logo: '',
    favicon: '',
    admin_email: 'admin@example.com',
    contact_email: 'contact@example.com',
    posts_per_page: '6',
    default_post_status: 'draft',
    maintenance_mode: 'false',
    facebook_link: '#',
    youtube_link: '#',
    telegram_link: '#',
    linkedin_link: '#'
  };
  for (const [key, value] of Object.entries(settings)) {
    await SiteSetting.findOrCreate({ where: { key }, defaults: { value } });
  }

  const securitySettings = {
    login_attempt_limiter: 'true',
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

  console.log('Seed complete. Login with admin@example.com / Admin@12345');
  await sequelize.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
