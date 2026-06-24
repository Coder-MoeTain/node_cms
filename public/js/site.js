document.querySelectorAll('img').forEach((img) => {
  if (img.closest('.portal-brand, .portal-footer-brand, .site-logo, .navbar-brand, .post-hero')) return;
  img.loading = 'lazy';
});

const supportedLanguages = ['my', 'zh-CN', 'en', 'ru'];
const languageLabels = {
  en: 'English',
  my: 'Myanmar',
  'zh-CN': 'Chinese',
  ru: 'Russian'
};

function isLocalHost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function clearTranslateCookie() {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `googtrans=; path=/; expires=${expires}`;
  if (!isLocalHost()) {
    document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=${expires}`;
  }
}

function setTranslateCookie(language) {
  if (language === 'en') {
    clearTranslateCookie();
    return;
  }
  const value = `/en/${language}`;
  document.cookie = `googtrans=${value}; path=/`;
  if (!isLocalHost()) {
    document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`;
  }
}

function getTranslateLanguage() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return 'en';
  const parts = decodeURIComponent(match[1]).split('/');
  const lang = parts[2] || 'en';
  return lang === 'en' ? 'en' : lang;
}

function updateLanguageUi(language) {
  const label = languageLabels[language] || languageLabels.en;
  document.querySelectorAll('.language-current').forEach((node) => {
    node.textContent = label;
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
}

function ensureTranslateOptions(select) {
  if (!select) return select;
  if (select.options.length > 1) return select;

  const fallbackLanguages = [
    { value: '', text: 'Select Language' },
    { value: 'my', text: 'Myanmar' },
    { value: 'zh-CN', text: 'Chinese (Simplified)' },
    { value: 'ru', text: 'Russian' }
  ];

  fallbackLanguages.forEach(({ value, text }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  return select;
}

function revealTranslateGadget() {
  const gadget = document.querySelector('.goog-te-gadget');
  if (!gadget) return;
  gadget.style.setProperty('display', 'block', 'important');
  gadget.style.visibility = 'hidden';
  gadget.style.position = 'absolute';
  gadget.style.left = '-9999px';
  gadget.style.width = '200px';
}

function getTranslateSelect() {
  return document.querySelector('.goog-te-combo');
}

function waitForTranslateSelect(maxAttempts = 50) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = () => {
      const select = ensureTranslateOptions(getTranslateSelect());
      if (select && select.options && select.options.length > 1) {
        resolve(select);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        resolve(select || null);
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

function triggerTranslateSelect(select, language) {
  if (!select) return false;
  const hasOption = [...select.options].some((option) => option.value === language);
  if (!hasOption) return false;
  select.value = language;
  select.dispatchEvent(new Event('change'));
  return true;
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
  setTranslateCookie(language);
  updateLanguageUi(language);
  window.location.reload();
}

async function applySavedLanguage() {
  const saved = getTranslateLanguage();
  updateLanguageUi(saved);
  if (saved === 'en') return;

  const select = await waitForTranslateSelect();
  if (triggerTranslateSelect(select, saved)) {
    setLanguageLoading(false);
  }
}

window.googleTranslateElementInit = function googleTranslateElementInit() {
  if (!window.google?.translate?.TranslateElement) return;

  new window.google.translate.TranslateElement(
    {
      pageLanguage: 'en',
      includedLanguages: supportedLanguages.join(','),
      layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL
    },
    'google_translate_element'
  );

  setTimeout(() => {
    revealTranslateGadget();
    applySavedLanguage();
  }, 300);
};

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

updateLanguageUi(getTranslateLanguage());

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

function initSectionNavSpy() {
  const nav = document.querySelector('[data-portal-section-nav]');
  if (!nav) return;

  const links = [...nav.querySelectorAll('[data-section-target]')];
  if (!links.length) return;

  const sections = links
    .map((link) => document.getElementById(link.dataset.sectionTarget))
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (id) => {
    links.forEach((link) => {
      const active = link.dataset.sectionTarget === id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) setActive(visible[0].target.id);
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  sections.forEach((section) => observer.observe(section));
  setActive(sections[0].id);
}

initSectionNavSpy();

