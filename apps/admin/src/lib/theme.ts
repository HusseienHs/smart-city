/**
 * Light or dark. A choice saved in this browser wins; without one, the operating system's
 * preference is followed.
 */
export type AdminTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'smart-city.theme';

/**
 * Runs in <head> before paint (see the root layout): applies the saved theme, or the system
 * preference when nothing is saved, so the first frame is already in the right theme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()`;

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
  const root = document.documentElement;
  // Colors switch at once instead of every element running its own hover transition.
  root.dataset.themeSwitching = '';
  root.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      delete root.dataset.themeSwitching;
    });
  });
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies until the page reloads.
  }
}
