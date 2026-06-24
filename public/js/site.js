document.querySelectorAll('img').forEach((img) => {
  img.loading = 'lazy';
});

const supportedLanguages = ['my', 'zh-CN', 'en', 'ru'];

function setTranslateCookie(language) {
  const value = `/en/${language}`;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`;
}

function getTranslateLanguage() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return 'en';
  const parts = decodeURIComponent(match[1]).split('/');
  return parts[2] || 'en';
}

function markActiveLanguage(language) {
  document.querySelectorAll('.language-flag').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === language);
  });
}

function applyLanguage(language) {
  if (!supportedLanguages.includes(language)) return;
  setTranslateCookie(language);
  markActiveLanguage(language);

  const select = document.querySelector('.goog-te-combo');
  if (select) {
    select.value = language;
    select.dispatchEvent(new Event('change'));
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
  markActiveLanguage(getTranslateLanguage());
};

document.querySelectorAll('.language-flag').forEach((button) => {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang));
});

markActiveLanguage(getTranslateLanguage());
