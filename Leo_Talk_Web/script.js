/**
 * LeoTalk Landing Page — Scripts
 */

(function () {
  'use strict';

  const header = document.getElementById('header');
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const langSelect = document.getElementById('langSelect');

  function resolveLink(path) {
    if (!window.LEOTALK_LINKS || !path) return null;
    return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), window.LEOTALK_LINKS);
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
  }

  /* Apply central link registry to data-link elements */
  function applyLinkData() {
    document.querySelectorAll('[data-link]').forEach((el) => {
      const url = resolveLink(el.getAttribute('data-link'));
      if (!url) return;

      el.setAttribute('href', url);

      if (el.hasAttribute('data-external') || isExternal(url)) {
        if (!/^mailto:/i.test(url)) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
  }

  applyLinkData();

  /* Header scroll effect */
  if (header) {
    function handleScroll() {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* Mobile menu toggle */
  if (mobileToggle && mobileMenu) {
    const mobileLinks = mobileMenu.querySelectorAll('a');

    function toggleMenu(forceClose) {
      const isOpen = forceClose === true
        ? false
        : mobileToggle.getAttribute('aria-expanded') !== 'true';

      mobileToggle.setAttribute('aria-expanded', isOpen);
      mobileMenu.setAttribute('aria-hidden', !isOpen);
      mobileMenu.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
      mobileToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    }

    mobileToggle.addEventListener('click', () => toggleMenu());

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => toggleMenu(true));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        toggleMenu(true);
      }
    });
  }

  /* Scroll-triggered fade-in animations */
  const fadeElements = document.querySelectorAll('.fade-in-up');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    fadeElements.forEach((el) => observer.observe(el));
  } else {
    fadeElements.forEach((el) => el.classList.add('visible'));
  }

  /* Smooth scroll for same-page anchor links */
  if (header) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        e.preventDefault();
        const offset = header.offsetHeight + 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }

  /* Language selector */
  if (langSelect && window.LEOTALK_LINKS?.languages) {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get('lang') || 'en';

    if (window.LEOTALK_LINKS.languages[currentLang]) {
      langSelect.value = currentLang;
    }

    langSelect.addEventListener('change', () => {
      const lang = langSelect.value;
      const target = window.LEOTALK_LINKS.languages[lang];
      if (target) {
        const base = target.split('?')[0];
        const query = lang === 'en' ? '' : `?lang=${lang}`;
        window.location.href = base + query;
      }
    });
  }
})();
