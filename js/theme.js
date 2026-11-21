// Light or dark. The setting is 'auto' (follow the device), 'light' or 'dark'.
// The colours themselves are in css/app.css under :root[data-theme="dark"].

const KEY = 'sidenote.v1';

export function resolveTheme(setting) {
  if (setting === 'dark' || setting === 'light') return setting;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(setting) {
  document.documentElement.dataset.theme = resolveTheme(setting);
}

// For the plain pages, which don't load the whole app
export function savedTheme() {
  try {
    return JSON.parse(localStorage.getItem(KEY)).settings.theme || 'auto';
  } catch {
    return 'auto';
  }
}
