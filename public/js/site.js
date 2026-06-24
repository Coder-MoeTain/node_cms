document.querySelectorAll('img').forEach((img) => {
  img.loading = 'lazy';
});

const supportedLanguages = ['my', 'zh-CN', 'en', 'ru'];
const languageLabels = {
  en: 'English',
  my: 'Myanmar',
  'zh-CN': 'Chinese',
  ru: 'Russian'
};

function clearTranslateCookie() {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `googtrans=; path=/; expires=${expires}`;
  document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=${expires}`;
}

function setTranslateCookie(language) {
  if (language === 'en') {
    clearTranslateCookie();
    return;
  }
  const value = `/en/${language}`;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`;
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
    button.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

function applyLanguage(language) {
  if (!supportedLanguages.includes(language)) return;

  const toggle = document.querySelector('.language-toggle');
  toggle?.classList.add('is-loading');
  toggle?.setAttribute('aria-busy', 'true');

  setTranslateCookie(language);
  updateLanguageUi(language);

  const select = document.querySelector('.goog-te-combo');
  if (language === 'en') {
    if (select) {
      select.value = '';
      select.dispatchEvent(new Event('change'));
    }
    window.location.reload();
    return;
  }

  if (select) {
    select.value = language;
    select.dispatchEvent(new Event('change'));
    toggle?.classList.remove('is-loading');
    toggle?.removeAttribute('aria-busy');
    return;
  }

  window.location.reload();
}

window.googleTranslateElementInit = function googleTranslateElementInit() {
  new window.google.translate.TranslateElement(
    {
      pageLanguage: 'en',
      includedLanguages: supportedLanguages.join(','),
      autoDisplay: false
    },
    'google_translate_element'
  );
  updateLanguageUi(getTranslateLanguage());
};

document.querySelectorAll('.language-option').forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
    const menu = button.closest('.dropdown-menu');
    const dropdown = button.closest('.dropdown');
    if (menu && dropdown) {
      bootstrap.Dropdown.getOrCreateInstance(dropdown.querySelector('[data-bs-toggle="dropdown"]'))?.hide();
    }
  });
});

updateLanguageUi(getTranslateLanguage());
