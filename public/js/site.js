document.querySelectorAll('img').forEach((img) => {
  if (img.closest('.portal-brand, .portal-footer-brand, .site-logo, .navbar-brand, .post-hero')) return;
  img.loading = 'lazy';
});

const supportedLanguages = ['my', 'zh-CN', 'en', 'ru'];
const languageLabels = {
  en: 'English',
  my: 'Burmese',
  'zh-CN': 'Chinese',
  ru: 'Russian'
};
const languageNatives = {
  en: 'English',
  my: 'မြန်မာ',
  'zh-CN': '中文',
  ru: 'Русский'
};
const flagByLanguage = {
  en: 'en',
  my: 'my',
  'zh-CN': 'zh',
  ru: 'ru'
};
const LOCALE_COOKIE = 'np_lang';

function isLocalHost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function clearLocaleCookie() {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${LOCALE_COOKIE}=; path=/; expires=${expires}`;
  document.cookie = `googtrans=; path=/; expires=${expires}`;
  if (!isLocalHost()) {
    document.cookie = `${LOCALE_COOKIE}=; path=/; domain=${window.location.hostname}; expires=${expires}`;
    document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=${expires}`;
  }
}

function setLocaleCookie(language) {
  if (language === 'en') {
    clearLocaleCookie();
    return;
  }
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(language)}; path=/; max-age=31536000; SameSite=Lax`;
  if (!isLocalHost()) {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(language)}; path=/; domain=${window.location.hostname}; max-age=31536000; SameSite=Lax`;
  }
}

function getLocaleLanguage() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);

  const legacy = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!legacy) return 'en';
  const parts = decodeURIComponent(legacy[1]).split('/');
  return parts[2] || 'en';
}

function updateLanguageUi(language) {
  const native = languageNatives[language] || languageNatives.en;
  const flag = flagByLanguage[language] || 'en';
  document.querySelectorAll('.language-current').forEach((node) => {
    node.textContent = native;
  });
  document.querySelectorAll('[data-language-toggle-flag]').forEach((node) => {
    node.className = `np-lang-flag np-lang-flag--${flag} language-toggle-flag`;
    node.dataset.flag = flag;
  });
  document.querySelectorAll('.language-option').forEach((button) => {
    const isActive = button.dataset.lang === language;
    button.classList.toggle('active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
  document.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : language;
}

function setLanguageLoading(isLoading) {
  const toggle = document.querySelector('.language-toggle');
  if (!toggle) return;
  toggle.classList.toggle('is-loading', isLoading);
  if (isLoading) {
    toggle.setAttribute('aria-busy', 'true');
  } else {
    toggle.removeAttribute('aria-busy');
  }
}

function applyLanguage(language) {
  if (!supportedLanguages.includes(language)) return;

  setLanguageLoading(true);
  setLocaleCookie(language);
  updateLanguageUi(language);
  window.location.reload();
}

document.querySelectorAll('.language-option').forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
    const dropdown = button.closest('.dropdown');
    const toggle = dropdown?.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle && window.bootstrap) {
      bootstrap.Dropdown.getOrCreateInstance(toggle)?.hide();
    }
  });
});

updateLanguageUi(getLocaleLanguage());

function initPortalHeader() {
  const header = document.querySelector('[data-portal-header]');
  if (!header) return;

  const navCollapse = header.querySelector('[data-portal-nav]');
  const overlay = header.querySelector('[data-portal-overlay]');
  const menuToggle = header.querySelector('[data-portal-menu-toggle]');

  function closeMobileNav() {
    navCollapse?.classList.remove('is-open');
    overlay?.setAttribute('hidden', '');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('portal-nav-open');
    navCollapse?.removeAttribute('aria-modal');
  }

  menuToggle?.addEventListener('click', () => {
    const open = navCollapse?.classList.toggle('is-open');
    if (overlay) {
      if (open) overlay.removeAttribute('hidden');
      else overlay.setAttribute('hidden', '');
    }
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('portal-nav-open', open);
    if (open) navCollapse?.setAttribute('aria-modal', 'true');
    else navCollapse?.removeAttribute('aria-modal');
  });

  overlay?.addEventListener('click', closeMobileNav);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMobileNav();
    header.querySelectorAll('.portal-nav-item.is-open').forEach((item) => {
      item.classList.remove('is-open');
      const toggle = item.querySelector('.portal-nav-submenu-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  });

  header.querySelectorAll('.portal-nav-submenu-toggle').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = btn.closest('.portal-nav-item');
      if (!item) return;
      const willOpen = !item.classList.contains('is-open');
      header.querySelectorAll('.portal-nav-item.is-open').forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          const toggle = openItem.querySelector('.portal-nav-submenu-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });

  if (window.matchMedia('(min-width: 992px)').matches) {
    header.querySelectorAll('.portal-nav-item.has-mega, .portal-nav-item.has-dropdown').forEach((item) => {
      item.addEventListener('mouseenter', () => {
        item.classList.add('is-open');
        const toggle = item.querySelector('.portal-nav-submenu-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
      });
      item.addEventListener('mouseleave', () => {
        item.classList.remove('is-open');
        const toggle = item.querySelector('.portal-nav-submenu-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('[data-font-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scale = btn.dataset.fontScale || 'normal';
      document.documentElement.setAttribute('data-font-scale', scale);
      document.querySelectorAll('[data-font-scale]').forEach((node) => {
        node.classList.toggle('active', node === btn);
      });
      try {
        localStorage.setItem('np-font-scale', scale);
      } catch (e) { /* ignore */ }
    });
  });

  const savedScale = (() => {
    try { return localStorage.getItem('np-font-scale'); } catch (e) { return null; }
  })();
  if (savedScale) {
    document.documentElement.setAttribute('data-font-scale', savedScale);
    document.querySelectorAll('[data-font-scale]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fontScale === savedScale);
    });
  }
}

initPortalHeader();

function initPortalPolish() {
  const header = document.querySelector('[data-portal-header]');
  if (!header) return;

  const onScroll = () => header.classList.toggle('portal-header-scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('a[href^="#portal-"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      const nav = header.querySelector('[data-portal-nav]');
      const overlay = header.querySelector('[data-portal-overlay]');
      const toggle = header.querySelector('[data-portal-menu-toggle]');
      nav?.classList.remove('is-open');
      overlay?.setAttribute('hidden', '');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('portal-nav-open');
    });
  });
}

initPortalPolish();

function initPortalCarousel() {
  const carousel = document.querySelector('#homeSlider.portal-hero-carousel, #homeSlider[data-portal-carousel]');
  if (!carousel) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    carousel.removeAttribute('data-bs-ride');
  }
}

function initBackToTop() {
  const btn = document.querySelector('[data-portal-back-top]');
  if (!btn) return;
  const threshold = 360;
  const onScroll = () => {
    const visible = window.scrollY > threshold;
    btn.hidden = !visible;
    btn.classList.toggle('is-visible', visible);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  });
  onScroll();
}

initPortalCarousel();
initBackToTop();

function initNavbarScroll() {
  const navbar = document.querySelector('.site-navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

initNavbarScroll();

document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', () => {
    const submit = form.querySelector('[type="submit"]:not([disabled])');
    if (!submit || submit.dataset.loading) return;
    const label = submit.dataset.loadingLabel;
    if (label) {
      submit.dataset.loading = '1';
      submit.disabled = true;
      submit.textContent = label;
    }
  });
});
