export const SIDEBAR_STORAGE_KEY = 'tempo:sidebar';

export type SidebarMode = 'full' | 'rail';

const listeners = new Set<() => void>();

export function readSidebarMode(): SidebarMode {
  if (typeof document === 'undefined') return 'full';
  return document.documentElement.dataset.sidebar === 'rail' ? 'rail' : 'full';
}

export function writeSidebarMode(mode: SidebarMode) {
  if (mode === 'rail') {
    document.documentElement.dataset.sidebar = 'rail';
  } else {
    delete document.documentElement.dataset.sidebar;
  }

  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, mode);
  } catch {
    // Private browsing can refuse storage; the choice still applies to this page.
  }

  listeners.forEach((listener) => listener());
}

export function subscribeSidebarMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
