/**
 * Whether the desktop sidebar is collapsed to an icon rail, saved in this browser. Applied as
 * `data-sidebar="collapsed"` on <html> before paint, so the first frame has the right layout;
 * globals.css turns it into the `rail:` variant.
 */
export const SIDEBAR_STORAGE_KEY = 'smart-city.sidebar';

export const SIDEBAR_SCRIPT = `(function(){try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}})()`;

const SIDEBAR_EVENT = 'smart-city:sidebar';

export function readSidebarCollapsed(): boolean {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

export function subscribeSidebar(onChange: () => void): () => void {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (collapsed) document.documentElement.dataset.sidebar = 'collapsed';
  else delete document.documentElement.dataset.sidebar;
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Storage unavailable: the choice still applies until the page reloads.
  }
}
