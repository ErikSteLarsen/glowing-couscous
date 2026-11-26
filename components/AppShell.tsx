'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { BrandMark, BrandName } from '@/components/BrandMark';
import { buttonFocusClassName, iconButtonClassName } from '@/components/ui';
import type { SessionUser } from '@/lib/auth-session';

type ColorTheme = 'dark' | 'light';
let sessionTheme: ColorTheme = 'dark';

function subscribeToTheme(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('wattonaut-theme-changed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('wattonaut-theme-changed', onChange);
  };
}

function getClientTheme(): ColorTheme {
  try { return window.localStorage.getItem('tempo-theme') === 'light' ? 'light' : 'dark'; }
  catch { return sessionTheme; }
}

function getServerTheme(): ColorTheme { return 'dark'; }

let sessionMenuHidden = false;
let menuStorageUnavailable = false;
function subscribeToMenu(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('wattonaut-menu-changed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('wattonaut-menu-changed', onChange);
  };
}
function getMenuHidden() {
  if (menuStorageUnavailable) return sessionMenuHidden;
  try { return window.localStorage.getItem('tempo-menu-hidden') === 'true'; }
  catch { return sessionMenuHidden; }
}
function getServerMenuHidden() { return false; }

export function AppShell({
  user,
  children,
}: {
  user: SessionUser & { role: 'COACH' | 'ATHLETE' };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigationPathname = pathname;
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const mobileOpen = isMobileViewport && mobileOpenPath === pathname;
  const menuHidden = useSyncExternalStore(subscribeToMenu, getMenuHidden, getServerMenuHidden);
  const theme = useSyncExternalStore(subscribeToTheme, getClientTheme, getServerTheme);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopMenuButtonRef = useRef<HTMLButtonElement>(null);

  // A browser history change also dismisses the drawer, without reopening it
  // when the user returns to the route on which it was originally opened.
  if (mobileOpenPath !== null && mobileOpenPath !== pathname) setMobileOpenPath(null);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    sessionTheme = next;
    try { window.localStorage.setItem('tempo-theme', next); } catch { /* Keep this session's choice. */ }
    document.documentElement.dataset.workspaceTheme = next;
    window.dispatchEvent(new Event('wattonaut-theme-changed'));
  };

  useEffect(() => {
    document.documentElement.dataset.workspaceTheme = theme;
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = (event?: MediaQueryListEvent) => {
      const sidebarHadFocus = document.getElementById('wattonaut-sidebar')?.contains(document.activeElement);
      setIsMobileViewport(mediaQuery.matches);
      if (!mediaQuery.matches) setMobileOpenPath(null);
      if (event) requestAnimationFrame(() => {
        // CSS may hide the focused control before the media-query event fires.
        if (!sidebarHadFocus && document.activeElement !== document.body) return;
        if (mediaQuery.matches || getMenuHidden()) (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus();
        else document.getElementById('wattonaut-hide-menu')?.focus();
      });
    };
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);

    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpenPath(null);
        requestAnimationFrame(() => (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus());
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!isMobileViewport) return;
    let start: { x: number; y: number; time: number } | null = null;
    const onStart = (event: TouchEvent) => {
      start = null;
      const target = event.target as HTMLElement;
      if (event.touches.length !== 1 || target.closest('input, textarea, select, [contenteditable], [role="slider"], dialog')) return;
      const touch = event.touches[0];
      // Leave the outer edge to native browser history gestures.
      if (!mobileOpen && (touch.clientX < 20 || touch.clientX > 48)) return;
      if (mobileOpen && !target.closest('#wattonaut-sidebar')) return;
      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || event.changedTouches.length !== 1) { start = null; return; }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const deliberate = Date.now() - start.time < 700 && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 2;
      start = null;
      if (!deliberate) return;
      if (!mobileOpen && dx > 0) setMobileOpenPath(pathname);
      if (mobileOpen && dx < 0) {
        setMobileOpenPath(null);
        requestAnimationFrame(() => (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus());
      }
    };
    const cancel = () => { start = null; };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', cancel);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [isMobileViewport, mobileOpen, pathname]);

  const closeMobileMenu = () => {
    setMobileOpenPath(null);
    if (mobileOpen) requestAnimationFrame(() => (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus());
  };

  // After choosing a destination, focus belongs to the new page rather than the menu button.
  const closeAfterNavigation = () => {
    if (!mobileOpen) return;
    setMobileOpenPath(null);
    requestAnimationFrame(() => document.getElementById('main')?.focus());
  };

  const setDesktopMenuHidden = (hidden: boolean) => {
    sessionMenuHidden = hidden;
    try { window.localStorage.setItem('tempo-menu-hidden', String(hidden)); }
    catch { menuStorageUnavailable = true; }
    window.dispatchEvent(new Event('wattonaut-menu-changed'));
    requestAnimationFrame(() => {
      if (hidden) (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus();
      else document.getElementById('wattonaut-hide-menu')?.focus();
    });
  };

  // Riding, the Ride home, the Send to Wattonaut window and the block timer are full-bleed: no sidebar or top bar.
  if (/^\/athlete\/(?:ride(?:\/\d+|\/send)?|live\/\d+)\/?$/.test(pathname)) {
    return <div id="main" tabIndex={-1} className="ink-studio-app outline-none">{children}</div>;
  }

  return (
    <div
      className="ink-studio-app wattonaut-shell relative min-h-screen bg-[var(--background)] text-[var(--text-secondary)]"
      data-menu-hidden={menuHidden}
    >
      <Link
        href="#main"
        className="sr-only z-50 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm hover:bg-[var(--signal-hover)] font-medium text-[var(--signal-ink)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </Link>
      <AppSidebar
        user={user}
        pathname={navigationPathname}
        mobileOpen={mobileOpen}
        isMobileViewport={isMobileViewport}
        onClose={closeMobileMenu}
        onNavigate={closeAfterNavigation}
        onHide={() => setDesktopMenuHidden(true)}
        previewMode={false}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div
        className="relative z-10 with-sidebar min-w-0"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
      >
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur-md md:hidden">
          <Link href="/athlete" aria-label="Wattonaut home" className={`flex min-h-11 items-center gap-2.5 rounded-lg hover:bg-[var(--raised)] ${buttonFocusClassName}`}>
            <BrandMark />
            <BrandName />
          </Link>
          <button
            type="button"
            aria-controls="wattonaut-sidebar"
            aria-expanded={mobileOpen}
            aria-label="Open menu"
            title="Show menu"
            ref={menuButtonRef}
            className={`inline-flex size-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName}`}
            onClick={() => setMobileOpenPath(pathname)}
          >
            <Menu aria-hidden="true" size={18} strokeWidth={1.6} />
          </button>
        </header>
        <div className="wattonaut-menu-bar">
          <button
            type="button"
            aria-controls="wattonaut-sidebar"
            aria-expanded={isMobileViewport ? mobileOpen : !menuHidden}
            ref={desktopMenuButtonRef}
            aria-label="Show menu"
            title="Show menu"
            className={iconButtonClassName}
            onClick={() => setDesktopMenuHidden(false)}
          >
            <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div id="main" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
