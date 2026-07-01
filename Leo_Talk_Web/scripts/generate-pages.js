const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

const IMG = {
  communities: { src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Diverse team collaborating around a table' },
  blog: { src: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Laptop on a desk for writing and blogging' },
  business: { src: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Business professionals in a modern meeting' },
  support: { src: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Customer support team helping users' },
  company: { src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Bright modern office workspace' },
  careers: { src: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Team working together at computers' },
  security: { src: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&h=480&fit=crop&q=80&auto=format', alt: 'Secure mobile messaging and privacy' },
  gaming: { src: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Gaming community setup' },
  music: { src: 'https://images.unsplash.com/photo-1511379938544-c1f69419868d?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Music and creators community' },
  education: { src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Students studying together' },
  local: { src: 'https://images.unsplash.com/photo-1517457373958-b7bdd7c334f8?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Local community gathering' },
  tech: { src: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Developers collaborating on code' },
  wellness: { src: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Health and wellness community' },
  blogGroupCalls: { src: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=720&h=400&fit=crop&q=80&auto=format', alt: 'HD group video call' },
  blogStickers: { src: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7bba0?w=720&h=400&fit=crop&q=80&auto=format', alt: 'Creative stickers on mobile' },
  blogSync: { src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=720&h=400&fit=crop&q=80&auto=format', alt: 'Synced laptop and mobile workflow' },
  remoteTeam: { src: 'https://images.unsplash.com/photo-1600880292089-90a51dc3c0b1?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Remote team video standup' },
  healthcare: { src: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Healthcare secure communication' },
  educationBiz: { src: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=220&fit=crop&q=80&auto=format', alt: 'Education and classroom communication' },
  team1: { src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=320&h=320&fit=crop&q=80&auto=format', alt: 'Alex Rivera, CEO' },
  team2: { src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=320&h=320&fit=crop&q=80&auto=format', alt: 'Priya Sharma, CTO' },
  team3: { src: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=320&h=320&fit=crop&q=80&auto=format', alt: 'Jordan Lee, Head of Design' },
};

function cardImg(img) {
  return `<div class="card-image"><img src="${img.src}" alt="${img.alt}" width="400" height="180" loading="lazy" decoding="async"></div>`;
}

function imgCard(img, title, inner) {
  return `<div class="info-card glass has-image">${cardImg(img)}<h3>${title}</h3>${inner}</div>`;
}

function blogItem(img, date, datetime, href, title, excerpt) {
  return `<article class="blog-item glass has-image">
  <div class="blog-thumb"><img src="${img.src}" alt="${img.alt}" width="200" height="140" loading="lazy" decoding="async"></div>
  <div class="blog-item-body"><time datetime="${datetime}">${date}</time><h3><a href="${href}">${title}</a></h3><p>${excerpt}</p></div>
</article>`;
}

function teamCard(img, name, role) {
  return `<div class="team-card glass"><img class="team-photo" src="${img.src}" alt="${img.alt}" width="120" height="120" loading="lazy" decoding="async"><h3>${name}</h3><p>${role}</p></div>`;
}

function navLink(href, label, activePage, pageKey) {
  const cls = activePage === pageKey ? ' class="nav-active"' : '';
  return `<li><a href="${href}"${cls}>${label}</a></li>`;
}

function shell({ title, description, breadcrumb, body, activePage, hero }) {
  const nav = (key, href, label) => navLink(href, label, activePage, key);
  const heroHtml = hero
    ? `<div class="page-hero"><img src="${hero.src}" alt="${hero.alt}" width="1200" height="420" loading="eager" decoding="async"><div class="page-hero-overlay" aria-hidden="true"></div></div>`
    : '';
  const mainClass = hero ? 'subpage has-hero' : 'subpage';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <meta name="author" content="LeoTalk">
  <meta property="og:title" content="${title} — LeoTalk">
  <meta property="og:description" content="${description}">
  ${hero ? `<meta property="og:image" content="${hero.src}">` : ''}
  <title>${title} — LeoTalk</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://images.unsplash.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header class="header scrolled" id="header">
    <nav class="nav container" aria-label="Main navigation">
      <a href="../index.html" class="logo" aria-label="LeoTalk home">
        <span class="logo-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="url(#logoGrad)"/><path d="M10 12c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-4l-4 3v-3h-2c-1.1 0-2-.9-2-2v-6z" fill="white"/><defs><linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs></svg>
        </span>
        <span class="logo-text">LeoTalk</span>
      </a>
      <ul class="nav-links" role="list">
        ${nav('features', '../index.html#features', 'Features')}
        ${nav('communities', 'communities.html', 'Communities')}
        ${nav('blog', 'blog.html', 'Blog')}
        ${nav('security', 'security.html', 'Security')}
        ${nav('business', 'business.html', 'Business')}
        ${nav('support', 'support.html', 'Support')}
        <li><a href="../index.html#download" class="nav-cta">Download</a></li>
      </ul>
      <button class="mobile-toggle" id="mobileToggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span class="hamburger" aria-hidden="true"></span></button>
    </nav>
    <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
      <ul role="list">
        ${nav('features', '../index.html#features', 'Features')}
        ${nav('communities', 'communities.html', 'Communities')}
        ${nav('blog', 'blog.html', 'Blog')}
        ${nav('security', 'security.html', 'Security')}
        ${nav('business', 'business.html', 'Business')}
        ${nav('support', 'support.html', 'Support')}
        <li><a href="../index.html#download" class="nav-cta">Download</a></li>
      </ul>
    </div>
  </header>
  <main id="main" class="${mainClass}">
    ${heroHtml}
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>
      <article class="subpage-content glass">${body}</article>
    </div>
  </main>
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand"><a href="../index.html" class="logo"><span class="logo-text">LeoTalk</span></a><p class="footer-tagline">Stay close, wherever you are.</p></div>
        <div class="footer-links-group"><h3>Product</h3><ul role="list"><li><a href="../index.html#features">Features</a></li><li><a href="communities.html">Communities</a></li><li><a href="blog.html">Blog</a></li><li><a href="security.html">Security</a></li><li><a href="business.html">Business</a></li><li><a href="support.html">Support</a></li></ul></div>
        <div class="footer-links-group"><h3>Company</h3><ul role="list"><li><a href="company.html">Company</a></li><li><a href="brand-center.html">Brand Center</a></li><li><a href="careers.html">Careers</a></li></ul></div>
        <div class="footer-links-group"><h3>Terms &amp; Policies</h3><ul role="list"><li><a href="terms-of-service.html">Terms of Service</a></li><li><a href="privacy-policy.html">Privacy Policy</a></li><li><a href="ads-policy.html">Ads Policy</a></li></ul></div>
        <div class="footer-links-group"><h3>Download</h3><ul role="list"><li><a href="https://play.google.com/store/apps/details?id=com.leotalk.app" target="_blank" rel="noopener noreferrer">Android</a></li><li><a href="https://apps.apple.com/app/leotalk/id6478291034" target="_blank" rel="noopener noreferrer">iPhone &amp; iPad</a></li><li><a href="https://download.leotalk.com/windows/LeoTalk-Setup-x64.exe">Windows PC</a></li><li><a href="https://download.leotalk.com/mac/LeoTalk.dmg">Mac</a></li><li><a href="https://download.leotalk.com/linux/LeoTalk-x86_64.AppImage">Linux</a></li></ul></div>
      </div>
      <div class="footer-bottom">
        <p class="footer-copy">&copy; 2026 LeoTalk. All rights reserved.</p>
        <div class="footer-social" aria-label="Social media links">
          <a href="https://x.com/leotalk" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href="https://facebook.com/leotalk" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
          <a href="https://instagram.com/leotalk" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
          <a href="https://linkedin.com/company/leotalk" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.062 2.062 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
        </div>
        <div class="footer-lang">
          <label for="langSelect" class="sr-only">Select language</label>
          <select id="langSelect" class="lang-select" aria-label="Select language">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </div>
    </div>
  </footer>
  <script src="../data/images.js"></script>
  <script src="../data/links.js"></script>
  <script src="../script.js"></script>
</body>
</html>`;
}

const pages = {
  'communities.html': {
    activePage: 'communities',
    hero: IMG.communities,
    title: 'Communities',
    description: 'Join LeoTalk communities — discover groups around your interests, hobbies, and passions.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Communities</span>',
    body: `<h1>Communities</h1>
<p class="subpage-lead">Discover and join communities built around shared interests — from gaming and music to local events and professional networks.</p>
<div class="card-grid">
  <div class="info-card glass"><h3>Discover</h3><p>Browse trending communities or search by topic, location, or language. Follow channels that match your interests and get notified when something new happens.</p><a href="../index.html#download" class="btn btn-primary btn-sm">Get LeoTalk</a></div>
  <div class="info-card glass"><h3>Create</h3><p>Start your own community with custom channels, roles, welcome messages, and moderation tools. Grow from a small group chat to thousands of members.</p><a href="../index.html#download" class="btn btn-secondary btn-sm">Start a Community</a></div>
  <div class="info-card glass"><h3>Moderate</h3><p>Assign moderators, set posting rules, enable auto-moderation filters, and review member reports — all from a dedicated admin panel.</p><a href="support.html" class="btn btn-secondary btn-sm">Moderator Guide</a></div>
</div>
<h2>Popular categories</h2>
<div class="card-grid">
  ${imgCard(IMG.gaming, 'Gaming &amp; Esports', '<p>Find teammates, share clips, and coordinate matches in real time.</p>')}
  ${imgCard(IMG.music, 'Music &amp; Creators', '<p>Connect with fans, share releases, and host listening parties.</p>')}
  ${imgCard(IMG.education, 'Education', '<p>Study groups, course discussions, and peer tutoring channels.</p>')}
  ${imgCard(IMG.local, 'Local &amp; Events', '<p>Neighborhood groups, city updates, and event coordination.</p>')}
  ${imgCard(IMG.tech, 'Tech &amp; Developers', '<p>Open-source projects, hackathons, and engineering communities.</p>')}
  ${imgCard(IMG.wellness, 'Health &amp; Wellness', '<p>Support groups, fitness challenges, and mindfulness circles.</p>')}
</div>
<h2>Community features</h2>
<ul>
  <li>Public, private, and invite-only communities</li>
  <li>Topic-based channels within each community</li>
  <li>Announcements, polls, and pinned messages</li>
  <li>Community-wide voice and video calls</li>
  <li>Custom emoji and sticker packs per community</li>
</ul>`,
  },

  'blog.html': {
    activePage: 'blog',
    hero: IMG.blog,
    title: 'Blog',
    description: 'LeoTalk Blog — product updates, tips, and stories from our team and community.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Blog</span>',
    body: `<h1>Blog</h1>
<p class="subpage-lead">Product news, feature deep-dives, and stories from the LeoTalk community.</p>
<div class="blog-list">
  ${blogItem(IMG.blogGroupCalls, 'June 15, 2026', '2026-06-15', '#group-calls', 'Introducing HD Group Video Calls', 'Group video calls now support up to 32 participants with improved quality and lower latency.')}
  ${blogItem(IMG.blogStickers, 'May 28, 2026', '2026-05-28', '#stickers', 'Create Your Own Sticker Packs', 'Design and share custom sticker packs with friends and communities in just a few taps.')}
  ${blogItem(IMG.blogSync, 'May 10, 2026', '2026-05-10', '#sync', 'Seamless Call Handoff Across Devices', 'Move active voice and video calls between your phone and desktop with one tap.')}
  <article class="blog-item glass has-image">
    <div class="blog-thumb"><img src="${IMG.security.src}" alt="${IMG.security.alt}" width="200" height="140" loading="lazy" decoding="async"></div>
    <div class="blog-item-body"><time datetime="2026-04-22">April 22, 2026</time><h3><a href="security.html">How LeoTalk Protects Your Privacy</a></h3><p>A look at end-to-end encryption, secure backups, and the privacy controls you have today.</p></div>
  </article>
</div>
<section id="group-calls" class="blog-article">
  <div class="feature-image glass" style="margin-bottom:24px"><img src="${IMG.blogGroupCalls.src}" alt="${IMG.blogGroupCalls.alt}" width="720" height="400" loading="lazy" decoding="async"></div>
  <h2>Introducing HD Group Video Calls</h2>
  <p><time datetime="2026-06-15">June 15, 2026</time> · Product</p>
  <p>We're excited to roll out HD group video calls to all LeoTalk users. Whether you're catching up with family or running a team standup, group calls now support up to 32 participants with adaptive bitrate streaming that adjusts to each person's connection.</p>
  <p>New in this release: speaker spotlight view, screen sharing, virtual backgrounds, and in-call reactions. Update to the latest version on <a href="https://play.google.com/store/apps/details?id=com.leotalk.app" target="_blank" rel="noopener noreferrer">Android</a> or <a href="https://apps.apple.com/app/leotalk/id6478291034" target="_blank" rel="noopener noreferrer">iOS</a> to try it today.</p>
</section>
<section id="stickers" class="blog-article">
  <div class="feature-image glass" style="margin-bottom:24px"><img src="${IMG.blogStickers.src}" alt="${IMG.blogStickers.alt}" width="720" height="400" loading="lazy" decoding="async"></div>
  <h2>Create Your Own Sticker Packs</h2>
  <p><time datetime="2026-05-28">May 28, 2026</time> · Features</p>
  <p>Self-expression just got more personal. The new Sticker Studio lets you upload images, crop them, add text overlays, and publish packs to your friends or entire communities. Packs can include up to 30 stickers and are synced across all your devices instantly.</p>
</section>
<section id="sync" class="blog-article">
  <div class="feature-image glass" style="margin-bottom:24px"><img src="${IMG.blogSync.src}" alt="${IMG.blogSync.alt}" width="720" height="400" loading="lazy" decoding="async"></div>
  <h2>Seamless Call Handoff Across Devices</h2>
  <p><time datetime="2026-05-10">May 10, 2026</time> · Features</p>
  <p>Started a call on your phone but need to switch to your laptop? Tap "Transfer call" and LeoTalk moves the active session to your desktop in under two seconds — no disconnects, no re-dialing. Available on Windows, macOS, and Linux.</p>
</section>`,
  },

  'business.html': {
    activePage: 'business',
    hero: IMG.business,
    title: 'Business',
    description: 'LeoTalk for Business — secure team messaging, admin controls, and enterprise-ready features.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Business</span>',
    body: `<h1>LeoTalk for Business</h1>
<p class="subpage-lead">Secure messaging built for teams of every size — with admin controls, compliance tools, and dedicated support.</p>
<h2>Why teams choose LeoTalk</h2>
<ul>
  <li>End-to-end encrypted team chats and calls</li>
  <li>Centralized admin dashboard and user management</li>
  <li>SSO and directory sync (SAML, SCIM)</li>
  <li>Data retention and export policies</li>
  <li>Audit logs and compliance reporting</li>
  <li>24/7 priority support for enterprise plans</li>
</ul>
<h2>Plans</h2>
<div class="card-grid">
  <div class="info-card glass"><h3>Team</h3><p>Up to 50 members · $4/user/month</p><ul><li>Shared team channels</li><li>Admin console</li><li>5 GB file storage per user</li></ul><a href="mailto:business@leotalk.com?subject=Team%20Plan" class="btn btn-primary btn-sm">Contact Sales</a></div>
  <div class="info-card glass"><h3>Business</h3><p>Up to 500 members · Custom pricing</p><ul><li>SSO &amp; SCIM provisioning</li><li>Audit logs</li><li>Compliance data exports</li></ul><a href="mailto:business@leotalk.com?subject=Business%20Plan" class="btn btn-primary btn-sm">Contact Sales</a></div>
  <div class="info-card glass"><h3>Enterprise</h3><p>Unlimited scale · Custom pricing</p><ul><li>Dedicated account manager</li><li>On-premise deployment option</li><li>Custom SLA &amp; support</li></ul><a href="mailto:business@leotalk.com?subject=Enterprise%20Demo" class="btn btn-secondary btn-sm">Request Demo</a></div>
</div>
<h2>Use cases</h2>
<div class="card-grid">
  ${imgCard(IMG.remoteTeam, 'Remote teams', '<p>Keep distributed teams aligned with channels, threads, and HD video standups.</p>')}
  ${imgCard(IMG.healthcare, 'Healthcare', '<p>HIPAA-ready configurations with encrypted messaging and access controls.</p>')}
  ${imgCard(IMG.educationBiz, 'Education', '<p>Classroom communities, office hours, and parent-teacher communication.</p>')}
</div>`,
  },

  'support.html': {
    activePage: 'support',
    hero: IMG.support,
    title: 'Support',
    description: 'LeoTalk Support — help center, FAQs, and contact options.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Support</span>',
    body: `<h1>Support</h1>
<p class="subpage-lead">We're here to help. Find answers in our FAQ or reach out to our support team.</p>
<div class="subpage-actions">
  <a href="mailto:support@leotalk.com" class="btn btn-primary">Email Support</a>
  <a href="https://help.leotalk.com" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Help Center</a>
</div>
<h2>Quick links</h2>
<div class="card-grid">
  ${imgCard(IMG.blogSync, 'Getting started', '<p>Download, create an account, and send your first message in minutes.</p><a href="../index.html#download" class="btn btn-secondary btn-sm">Download</a>')}
  ${imgCard(IMG.security, 'Account &amp; privacy', '<p>Manage your profile, security settings, and data preferences.</p><a href="privacy-policy.html" class="btn btn-secondary btn-sm">Privacy Policy</a>')}
  ${imgCard(IMG.communities, 'Communities', '<p>Learn how to join, create, and moderate LeoTalk communities.</p><a href="communities.html" class="btn btn-secondary btn-sm">Communities Guide</a>')}
</div>
<h2>Frequently asked questions</h2>
<div class="faq-list">
  <div class="faq-item glass"><h3>How do I recover my account?</h3><p>Open LeoTalk, tap "Forgot password" on the login screen, and follow the email verification steps. If you enabled two-factor authentication, you'll need your backup codes.</p></div>
  <div class="faq-item glass"><h3>Is LeoTalk free?</h3><p>Yes. LeoTalk is free for personal use with all core messaging, calling, and sync features included. <a href="business.html">Business plans</a> add admin and enterprise tools.</p></div>
  <div class="faq-item glass"><h3>How do I report abuse?</h3><p>Long-press any message and select "Report." Our trust &amp; safety team reviews reports within 24 hours. For urgent issues, email <a href="mailto:abuse@leotalk.com">abuse@leotalk.com</a>.</p></div>
  <div class="faq-item glass"><h3>Which devices are supported?</h3><p>Android, iOS, Windows, macOS, and Linux. See our <a href="../index.html#download">download page</a> for the latest builds.</p></div>
  <div class="faq-item glass"><h3>How do I transfer chats to a new phone?</h3><p>Sign in on your new device with the same account. If you enabled encrypted cloud backup, restore from Settings → Chats → Backup on the new device.</p></div>
  <div class="faq-item glass"><h3>Can I use LeoTalk on multiple devices?</h3><p>Yes. LeoTalk syncs messages, media, and calls across all linked devices in real time. See <a href="../index.html#sync">device sync</a> on our homepage.</p></div>
</div>`,
  },

  'company.html': {
    activePage: 'company',
    hero: IMG.company,
    title: 'Company',
    description: 'About LeoTalk — our mission to help people stay close, wherever they are.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Company</span>',
    body: `<h1>About LeoTalk</h1>
<p class="subpage-lead">We believe communication should be fast, expressive, and private — no matter where life takes you.</p>
<p>Founded in 2024, LeoTalk set out to build a messaging platform that feels personal yet works at scale. Today, millions of people use LeoTalk every day to stay connected with friends, families, communities, and teams across 120+ countries.</p>
<h2>Our mission</h2>
<p>Stay close, wherever you are. We design every feature — from voice calls to sticker packs — to make real human connection feel effortless and secure.</p>
<h2>Our values</h2>
<ul>
  <li><strong>Privacy by design</strong> — encryption and user control are non-negotiable</li>
  <li><strong>Expressive communication</strong> — words, voice, video, stickers, and GIFs</li>
  <li><strong>Accessible everywhere</strong> — mobile and desktop, fully synced</li>
  <li><strong>Community first</strong> — tools that help groups thrive safely</li>
</ul>
<h2>Leadership</h2>
<div class="team-grid">
  ${teamCard(IMG.team1, 'Alex Rivera', 'CEO &amp; Co-founder')}
  ${teamCard(IMG.team2, 'Priya Sharma', 'CTO &amp; Co-founder')}
  ${teamCard(IMG.team3, 'Jordan Lee', 'Head of Design')}
</div>
<h2>Contact</h2>
<ul>
  <li>Press: <a href="mailto:press@leotalk.com">press@leotalk.com</a></li>
  <li>Partnerships: <a href="mailto:partners@leotalk.com">partners@leotalk.com</a></li>
  <li>General: <a href="mailto:hello@leotalk.com">hello@leotalk.com</a></li>
</ul>
<div class="subpage-actions"><a href="careers.html" class="btn btn-primary">View Careers</a><a href="brand-center.html" class="btn btn-secondary">Brand Center</a></div>`,
  },

  'brand-center.html': {
    activePage: 'brand',
    title: 'Brand Center',
    description: 'LeoTalk Brand Center — logos, colors, and brand guidelines.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <a href="company.html">Company</a> <span aria-hidden="true">/</span> <span>Brand Center</span>',
    body: `<h1>Brand Center</h1>
<p class="subpage-lead">Official LeoTalk brand assets and usage guidelines for press, partners, and creators.</p>
<h2>Logo</h2>
<p>Use the primary LeoTalk wordmark with adequate clear space (minimum 24px on all sides). Do not stretch, rotate, recolor, or place the logo on busy backgrounds without a container.</p>
<h2>Colors</h2>
<div class="card-grid">
  <div class="info-card glass" style="border-left: 4px solid #6366f1"><h3>Primary Indigo</h3><p>#6366f1 · RGB 99, 102, 241</p></div>
  <div class="info-card glass" style="border-left: 4px solid #06b6d4"><h3>Accent Cyan</h3><p>#06b6d4 · RGB 6, 182, 212</p></div>
  <div class="info-card glass" style="border-left: 4px solid #8b5cf6"><h3>Deep Purple</h3><p>#8b5cf6 · RGB 139, 92, 246</p></div>
  <div class="info-card glass" style="border-left: 4px solid #0f172a"><h3>Dark Text</h3><p>#0f172a · RGB 15, 23, 42</p></div>
</div>
<h2>Typography</h2>
<p>LeoTalk uses <strong>Inter</strong> for all product and marketing materials. Weights: 400 (body), 600 (labels), 700–800 (headlines).</p>
<h2>Usage guidelines</h2>
<ul>
  <li>Do not imply endorsement without written permission</li>
  <li>Do not modify the logo or combine it with other marks</li>
  <li>Use "LeoTalk" as one word with capital L and T</li>
  <li>Refer to the app as "LeoTalk", not "Leo Talk" or "leotalk"</li>
</ul>
<h2>Download assets</h2>
<p>Request a full press kit including SVG logos, app icons, screenshots, and brand guidelines PDF:</p>
<div class="subpage-actions"><a href="mailto:press@leotalk.com?subject=Press%20Kit%20Request" class="btn btn-primary">Request Press Kit</a></div>`,
  },

  'careers.html': {
    activePage: 'careers',
    hero: IMG.careers,
    title: 'Careers',
    description: 'Careers at LeoTalk — join our team and help build the future of messaging.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <a href="company.html">Company</a> <span aria-hidden="true">/</span> <span>Careers</span>',
    body: `<h1>Careers</h1>
<p class="subpage-lead">Help us build messaging that brings people closer. We're hiring across engineering, design, and operations.</p>
<h2>Why LeoTalk</h2>
<ul>
  <li>Competitive salary and equity</li>
  <li>Remote-first with optional SF office</li>
  <li>Health, dental, and vision coverage</li>
  <li>Generous PTO and parental leave</li>
  <li>Annual learning &amp; development budget</li>
</ul>
<h2>Open roles</h2>
<div class="card-grid">
  <div class="info-card glass"><h3>Senior iOS Engineer</h3><p>Remote · Full-time · Engineering</p><p>Build the LeoTalk iOS experience — SwiftUI, real-time messaging, and call quality.</p><a href="mailto:careers@leotalk.com?subject=Senior%20iOS%20Engineer" class="btn btn-primary btn-sm">Apply</a></div>
  <div class="info-card glass"><h3>Backend Engineer (Go)</h3><p>Remote · Full-time · Engineering</p><p>Scale our messaging infrastructure to serve millions of concurrent connections.</p><a href="mailto:careers@leotalk.com?subject=Backend%20Engineer" class="btn btn-primary btn-sm">Apply</a></div>
  <div class="info-card glass"><h3>Product Designer</h3><p>San Francisco / Remote · Design</p><p>Shape the future of expressive, accessible messaging interfaces.</p><a href="mailto:careers@leotalk.com?subject=Product%20Designer" class="btn btn-primary btn-sm">Apply</a></div>
  <div class="info-card glass"><h3>Trust &amp; Safety Analyst</h3><p>Remote · Full-time · Operations</p><p>Protect our community through policy enforcement and abuse detection.</p><a href="mailto:careers@leotalk.com?subject=Trust%20Safety%20Analyst" class="btn btn-primary btn-sm">Apply</a></div>
  <div class="info-card glass"><h3>Android Engineer</h3><p>Remote · Full-time · Engineering</p><p>Kotlin, Jetpack Compose, and low-latency real-time features on Android.</p><a href="mailto:careers@leotalk.com?subject=Android%20Engineer" class="btn btn-primary btn-sm">Apply</a></div>
  <div class="info-card glass"><h3>Developer Advocate</h3><p>Remote · Full-time · Marketing</p><p>Engage developers building on the LeoTalk platform and API.</p><a href="mailto:careers@leotalk.com?subject=Developer%20Advocate" class="btn btn-primary btn-sm">Apply</a></div>
</div>
<p>Don't see a fit? Send your resume to <a href="mailto:careers@leotalk.com">careers@leotalk.com</a>.</p>`,
  },

  'privacy-policy.html': {
    activePage: 'legal',
    title: 'Privacy Policy',
    description: 'LeoTalk Privacy Policy — how we collect, use, and protect your data.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Privacy Policy</span>',
    body: `<h1>Privacy Policy</h1>
<p class="subpage-lead">Last updated: January 1, 2026</p>
<p>LeoTalk Inc. ("LeoTalk", "we", "our", or "us") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and the choices you have.</p>
<h2>1. Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> phone number, display name, profile photo, and optional email address.</li>
  <li><strong>Messages:</strong> end-to-end encrypted content is not readable by LeoTalk. We process metadata (timestamps, delivery status) solely to deliver messages.</li>
  <li><strong>Contacts:</strong> if you grant permission, we hash phone numbers to help you find friends. We do not store your address book on our servers.</li>
  <li><strong>Device information:</strong> device type, OS version, app version, and language for compatibility and security.</li>
  <li><strong>Usage data:</strong> anonymized analytics about feature usage to improve the product. You can opt out in Settings.</li>
</ul>
<h2>2. How we use your information</h2>
<p>We use collected data to provide and improve LeoTalk, deliver messages and calls, prevent abuse, personalize your experience (with your consent), and comply with legal obligations. We do not sell your personal data to third parties.</p>
<h2>3. Data sharing</h2>
<p>We share data only with service providers who help us operate LeoTalk (hosting, analytics), when required by law, or to protect the safety of our users. All providers are bound by confidentiality agreements.</p>
<h2>4. Data retention</h2>
<p>Account data is retained while your account is active. Deleted messages are removed from our servers within 30 days. You can request full account deletion at any time.</p>
<h2>5. Your rights</h2>
<p>Depending on your location, you may have the right to access, correct, export, or delete your data. Use Settings → Privacy or contact <a href="mailto:privacy@leotalk.com">privacy@leotalk.com</a>.</p>
<h2>6. Children's privacy</h2>
<p>LeoTalk is not intended for children under 13. We do not knowingly collect data from children under 13.</p>
<h2>7. Contact</h2>
<p>LeoTalk Inc., 100 Market Street, Suite 300, San Francisco, CA 94105, USA.<br>Email: <a href="mailto:privacy@leotalk.com">privacy@leotalk.com</a></p>
<div class="subpage-actions"><a href="security.html" class="btn btn-secondary">Security Overview</a><a href="terms-of-service.html" class="btn btn-outline">Terms of Service</a></div>`,
  },

  'terms-of-service.html': {
    activePage: 'legal',
    title: 'Terms of Service',
    description: 'LeoTalk Terms of Service — rules and guidelines for using our platform.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Terms of Service</span>',
    body: `<h1>Terms of Service</h1>
<p class="subpage-lead">Last updated: January 1, 2026</p>
<p>By accessing or using LeoTalk, you agree to these Terms of Service ("Terms"). If you do not agree, do not use the service.</p>
<h2>1. Eligibility</h2>
<p>You must be at least 13 years old (or the minimum age in your jurisdiction) to use LeoTalk. If you are under 18, you must have parental consent.</p>
<h2>2. Your account</h2>
<p>You are responsible for maintaining the security of your account and all activity that occurs under it. Notify us immediately at <a href="mailto:support@leotalk.com">support@leotalk.com</a> if you suspect unauthorized access.</p>
<h2>3. Acceptable use</h2>
<p>You agree not to use LeoTalk to:</p>
<ul>
  <li>Harass, threaten, or harm others</li>
  <li>Distribute illegal, fraudulent, or malicious content</li>
  <li>Send spam or unsolicited messages</li>
  <li>Attempt to compromise our systems or other users' accounts</li>
  <li>Violate any applicable law or regulation</li>
</ul>
<h2>4. Content</h2>
<p>You retain ownership of content you create. By uploading content, you grant LeoTalk a limited license to host, store, and deliver it to your intended recipients. We may remove content that violates these Terms.</p>
<h2>5. Service availability</h2>
<p>We strive for high availability but do not guarantee uninterrupted service. We may modify, suspend, or discontinue features with reasonable notice.</p>
<h2>6. Limitation of liability</h2>
<p>LeoTalk is provided "as is." To the extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the service.</p>
<h2>7. Governing law</h2>
<p>These Terms are governed by the laws of the State of California, USA, without regard to conflict of law principles.</p>
<p>Questions? Contact <a href="mailto:legal@leotalk.com">legal@leotalk.com</a></p>
<div class="subpage-actions"><a href="privacy-policy.html" class="btn btn-secondary">Privacy Policy</a></div>`,
  },

  'security.html': {
    activePage: 'security',
    hero: IMG.security,
    title: 'Security Overview',
    description: 'LeoTalk Security — encryption, privacy controls, and how we protect your conversations.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Security</span>',
    body: `<h1>Security Overview</h1>
<p class="subpage-lead">LeoTalk is built with a privacy-first architecture to keep your conversations protected.</p>
<div class="feature-image glass" style="margin-bottom:32px"><img src="${IMG.security.src}" alt="${IMG.security.alt}" width="800" height="400" loading="lazy" decoding="async"></div>
<h2>End-to-end encryption</h2>
<p>Personal chats and calls use end-to-end encryption by default using the Signal Protocol. Only you and the people you're communicating with hold the keys — not even LeoTalk can decrypt your messages.</p>
<h2>Secure cloud backup</h2>
<p>Optional encrypted backups use a key derived from your password via PBKDF2. Backup data is stored encrypted at rest with AES-256-GCM in geographically distributed data centers.</p>
<h2>Authentication</h2>
<ul>
  <li>Two-factor authentication (SMS, authenticator app, or security key)</li>
  <li>Biometric app lock on supported devices</li>
  <li>Session management — view and revoke active devices</li>
  <li>Login notifications for new device sign-ins</li>
</ul>
<h2>Privacy controls</h2>
<ul>
  <li>Control who can add you to groups</li>
  <li>Hide last seen, online status, and read receipts</li>
  <li>Disappearing messages with custom timers (1 hour to 90 days)</li>
  <li>Block and report tools with 24-hour review SLA</li>
  <li>Screenshot notifications (optional, per chat)</li>
</ul>
<h2>Infrastructure security</h2>
<p>Our servers run in SOC 2 Type II certified data centers. We perform regular penetration testing, maintain a bug bounty program, and encrypt all data in transit with TLS 1.3.</p>
<h2>Reporting vulnerabilities</h2>
<p>Found a security issue? Report it responsibly to <a href="mailto:security@leotalk.com">security@leotalk.com</a>. We acknowledge reports within 48 hours and offer rewards for qualifying findings through our bug bounty program.</p>
<div class="subpage-actions"><a href="privacy-policy.html" class="btn btn-secondary">Privacy Policy</a><a href="terms-of-service.html" class="btn btn-outline">Terms of Service</a></div>`,
  },

  'ads-policy.html': {
    activePage: 'legal',
    title: 'Ads Policy',
    description: 'LeoTalk Ads Policy — guidelines for advertising on the LeoTalk platform.',
    breadcrumb: '<a href="../index.html">Home</a> <span aria-hidden="true">/</span> <span>Ads Policy</span>',
    body: `<h1>Ads Policy</h1>
<p class="subpage-lead">Last updated: January 1, 2026</p>
<p>LeoTalk offers optional advertising in select community channels. This policy defines what is allowed and how users maintain control.</p>
<h2>Where ads appear</h2>
<p>Ads may appear in community discovery feeds and sponsored channel placements. Ads never appear in personal chats, voice calls, or video calls.</p>
<h2>Prohibited content</h2>
<ul>
  <li>Misleading, deceptive, or false claims</li>
  <li>Adult content, weapons, tobacco, or illegal products</li>
  <li>Discriminatory targeting based on race, religion, health status, or other sensitive attributes</li>
  <li>Malware, phishing, or harmful software</li>
  <li>Political ads without proper disclosure and approval</li>
</ul>
<h2>User control</h2>
<ul>
  <li>Personal chats are never used for ad targeting or profiling</li>
  <li>Community admins can opt out of ads entirely for their community</li>
  <li>Users manage ad preferences in Settings → Privacy → Ads</li>
  <li>Report inappropriate ads via long-press → Report Ad</li>
</ul>
<h2>Advertiser requirements</h2>
<p>All advertisers must complete identity verification and agree to our advertising terms. We review all ad creatives before they go live.</p>
<h2>Advertise with LeoTalk</h2>
<p>Learn more at <a href="https://ads.leotalk.com" target="_blank" rel="noopener noreferrer">ads.leotalk.com</a> or contact <a href="mailto:ads@leotalk.com">ads@leotalk.com</a>.</p>
<div class="subpage-actions"><a href="privacy-policy.html" class="btn btn-secondary">Privacy Policy</a></div>`,
  },
};

for (const [filename, data] of Object.entries(pages)) {
  const html = shell(data);
  fs.writeFileSync(path.join(pagesDir, filename), html, 'utf8');
  console.log('Created pages/' + filename);
}

console.log('Done —', Object.keys(pages).length, 'pages in pages/');
