/** Light by default; dark only when the user turns it on (saved in this browser). */
export type AdminTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'smart-city.theme';

/** Runs in <head> before paint: applies a saved dark choice. */
export const THEME_SCRIPT = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

export function readTheme(): AdminTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

const THEME_EVENT = 'smart-city:theme';

/** For useSyncExternalStore: notifies when the theme changes. */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function applyTheme(theme: AdminTheme): void {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  window.dispatchEvent(new Event(THEME_EVENT));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies until the page reloads.
  }
}
