document.querySelectorAll('img').forEach((img) => {
  if (img.closest('.portal-brand, .portal-footer-brand, .site-logo, .navbar-brand, .post-hero')) return;
  if (!img.hasAttribute('loading')) img.loading = 'lazy';
  if (!img.hasAttribute('decoding')) img.decoding = 'async';
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

function initFontScaleControls() {
  document.querySelectorAll('[data-font-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scale = btn.dataset.fontScale || 'normal';
      document.documentElement.setAttribute('data-font-scale', scale);
      document.querySelectorAll('[data-font-scale]').forEach((node) => {
        node.classList.toggle('active', node.dataset.fontScale === scale);
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

initFontScaleControls();

function getFocusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
}

function initPortalHeader() {
  const header = document.querySelector('[data-portal-header]');
  if (!header) return;

  const navCollapse = header.querySelector('[data-portal-nav]');
  const overlay = header.querySelector('[data-portal-overlay]');
  const menuToggle = header.querySelector('[data-portal-menu-toggle]');

  function closeMobileNav() {
    navCollapse?.classList.remove('is-open');
    overlay?.setAttribute('hidden', '');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.classList.remove('is-active');
    }
    document.body.classList.remove('portal-nav-open');
    navCollapse?.removeAttribute('aria-modal');
  }

  function openMobileNav() {
    navCollapse?.classList.add('is-open');
    overlay?.removeAttribute('hidden');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.classList.add('is-active');
    }
    document.body.classList.add('portal-nav-open');
    navCollapse?.setAttribute('aria-modal', 'true');
    const firstLink = getFocusableElements(navCollapse)[0];
    firstLink?.focus();
  }

  menuToggle?.addEventListener('click', () => {
    if (navCollapse?.classList.contains('is-open')) closeMobileNav();
    else openMobileNav();
  });

  overlay?.addEventListener('click', closeMobileNav);

  navCollapse?.querySelectorAll('.portal-nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 991.98px)').matches) closeMobileNav();
    });
  });

  navCollapse?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !navCollapse.classList.contains('is-open')) return;
    const focusables = getFocusableElements(navCollapse);
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 992px)').matches) closeMobileNav();
  });

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
}

initPortalHeader();

function initStandardNavbar() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;

  const toggler = header.querySelector('.site-toggler');
  const collapse = header.querySelector('[data-site-nav]');

  const syncTogglerState = () => {
    toggler?.classList.toggle('is-active', collapse?.classList.contains('show'));
  };

  toggler?.addEventListener('click', () => {
    window.setTimeout(syncTogglerState, 0);
  });

  collapse?.addEventListener('shown.bs.collapse', syncTogglerState);
  collapse?.addEventListener('hidden.bs.collapse', () => toggler?.classList.remove('is-active'));

  collapse?.querySelectorAll('.nav-link:not(.dropdown-toggle), .dropdown-item').forEach((link) => {
    link.addEventListener('click', () => {
      if (!window.matchMedia('(max-width: 991.98px)').matches || !collapse?.classList.contains('show')) return;
      if (window.bootstrap?.Collapse) {
        bootstrap.Collapse.getOrCreateInstance(collapse)?.hide();
      }
      toggler?.classList.remove('is-active');
    });
  });
}

initStandardNavbar();

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

function initHeroCarousel() {
  const carousel = document.querySelector('#homeSlider[data-hero-carousel]');
  if (!carousel) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    carousel.removeAttribute('data-bs-ride');
  }

  const counter = carousel.querySelector('[data-hero-counter]');
  const live = carousel.querySelector('[data-hero-live]');
  const items = carousel.querySelectorAll('.carousel-item');
  const total = items.length;

  function syncHeroSlide(index) {
    const safeIndex = Math.max(0, Math.min(index, total - 1));
    const item = items[safeIndex];
    const title = item?.dataset.heroTitle || item?.querySelector('h1')?.textContent?.trim() || '';
    if (counter && total > 1) counter.textContent = `${safeIndex + 1} / ${total}`;
    if (live && title) live.textContent = `Showing slide ${safeIndex + 1} of ${total}: ${title}`;
  }

  carousel.addEventListener('slid.bs.carousel', (event) => {
    syncHeroSlide(event.to);
  });

  syncHeroSlide([...items].findIndex((item) => item.classList.contains('active')));

  if (!reducedMotion) {
    carousel.addEventListener('mouseenter', () => {
      if (window.bootstrap?.Carousel) bootstrap.Carousel.getOrCreateInstance(carousel)?.pause();
    });
    carousel.addEventListener('mouseleave', () => {
      if (window.bootstrap?.Carousel) bootstrap.Carousel.getOrCreateInstance(carousel)?.cycle();
    });
    carousel.addEventListener('focusin', () => {
      if (window.bootstrap?.Carousel) bootstrap.Carousel.getOrCreateInstance(carousel)?.pause();
    });
    carousel.addEventListener('focusout', (event) => {
      if (carousel.contains(event.relatedTarget)) return;
      if (window.bootstrap?.Carousel) bootstrap.Carousel.getOrCreateInstance(carousel)?.cycle();
    });
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

initHeroCarousel();

function initReadingProgress() {
  const bar = document.querySelector('[data-reading-progress]');
  const target = document.querySelector('.post-article, .post-page-shell, .post-page');
  if (!bar || !target) return;

  const update = () => {
    const rect = target.getBoundingClientRect();
    const total = target.scrollHeight - window.innerHeight;
    if (total <= 0) {
      bar.style.width = '0%';
      return;
    }
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    bar.style.width = `${(scrolled / total) * 100}%`;
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initPostToolbar() {
  document.querySelectorAll('[data-copy-url]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        const label = button.innerHTML;
        button.classList.add('is-copied');
        button.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i> Copied';
        window.setTimeout(() => {
          button.classList.remove('is-copied');
          button.innerHTML = label;
        }, 1800);
      } catch {
        window.prompt('Copy this link:', url);
      }
    });
  });

  document.querySelectorAll('[data-share-post]').forEach((button) => {
    button.addEventListener('click', async () => {
      const shareData = {
        title: button.dataset.shareTitle || document.title,
        url: window.location.href
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          // User dismissed share sheet.
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(shareData.url);
        button.classList.add('is-copied');
        window.setTimeout(() => button.classList.remove('is-copied'), 1800);
      } catch {
        window.prompt('Copy this link:', shareData.url);
      }
    });
  });

  document.querySelectorAll('[data-print-page]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });
}

function initCommentReply() {
  const parentField = document.getElementById('comment-parent-id');
  const contentField = document.getElementById('comment-content');
  const formTitle = document.querySelector('.post-comment-form-title');
  if (!parentField) return;

  document.querySelectorAll('[data-reply-to]').forEach((button) => {
    button.addEventListener('click', () => {
      parentField.value = button.getAttribute('data-reply-to') || '';
      contentField?.focus();
      if (formTitle) formTitle.textContent = 'Reply to comment';
    });
  });

  document.querySelector('.post-comment-form')?.addEventListener('reset', () => {
    parentField.value = '';
    if (formTitle) formTitle.textContent = 'Leave a reply';
  });
}

function initSkipLinkTarget() {
  const main = document.getElementById('main-content');
  if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
}

function initWidgetReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = document.querySelectorAll('.portal-widget, .site-service-card, .site-stat-item, .site-widget-card, .site-media-card');
  if (!nodes.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

  nodes.forEach((node, index) => {
    node.style.animationDelay = `${Math.min(index * 40, 240)}ms`;
    observer.observe(node);
  });
}

initWidgetReveal();
initBackToTop();
initReadingProgress();
initPostToolbar();
initCommentReply();
initSkipLinkTarget();

function initCountUp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = document.querySelectorAll('[data-count-up]');
  if (!nodes.length) return;

  const animate = (node) => {
    const raw = node.dataset.countRaw || node.textContent.replace(/[^0-9]/g, '');
    const target = Number(raw);
    if (!target || Number.isNaN(target)) return;
    const suffix = (node.dataset.countUp || '').replace(/[0-9,.\s]/g, '');
    const duration = 900;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.floor(target * progress);
      node.textContent = `${value.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
      else node.textContent = node.dataset.countUp;
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  nodes.forEach((node) => observer.observe(node));
}

initCountUp();

function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

initSmoothAnchors();

function initOutsideClickClose() {
  document.addEventListener('click', (event) => {
    const header = document.querySelector('[data-portal-header]');
    if (header && !header.contains(event.target)) {
      header.querySelectorAll('.portal-nav-item.is-open').forEach((item) => {
        item.classList.remove('is-open');
        const toggle = item.querySelector('.portal-nav-submenu-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

initOutsideClickClose();

function initNavbarScroll() {
  const navbar = document.querySelector('.site-navbar');
  const siteHeader = document.querySelector('[data-site-header]');
  const onScroll = () => {
    const scrolled = window.scrollY > 8;
    navbar?.classList.toggle('scrolled', scrolled);
    siteHeader?.classList.toggle('site-header-scrolled', scrolled);
  };
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
