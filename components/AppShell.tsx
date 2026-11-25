'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AppSidebar, navIconFor } from '@/components/AppSidebar';
import { BrandMark, BrandName } from '@/components/BrandMark';
import { buttonFocusClassName, iconButtonClassName } from '@/components/ui';
import { getMobileNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import type { SessionUser } from '@/lib/auth-session';

type ColorTheme = 'dark' | 'light';
let sessionTheme: ColorTheme = 'dark';

function subscribeToTheme(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('tempo-theme-changed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('tempo-theme-changed', onChange);
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
  window.addEventListener('tempo-menu-changed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('tempo-menu-changed', onChange);
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
  const navItems = getMobileNavigation(user.role);

  // A browser history change also dismisses the drawer, without reopening it
  // when the user returns to the route on which it was originally opened.
  if (mobileOpenPath !== null && mobileOpenPath !== pathname) setMobileOpenPath(null);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    sessionTheme = next;
    try { window.localStorage.setItem('tempo-theme', next); } catch { /* Keep this session's choice. */ }
    document.documentElement.dataset.workspaceTheme = next;
    window.dispatchEvent(new Event('tempo-theme-changed'));
  };

  useEffect(() => {
    document.documentElement.dataset.workspaceTheme = theme;
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = (event?: MediaQueryListEvent) => {
      const sidebarHadFocus = document.getElementById('tempo-sidebar')?.contains(document.activeElement);
      setIsMobileViewport(mediaQuery.matches);
      if (!mediaQuery.matches) setMobileOpenPath(null);
      if (event) requestAnimationFrame(() => {
        // CSS may hide the focused control before the media-query event fires.
        if (!sidebarHadFocus && document.activeElement !== document.body) return;
        if (mediaQuery.matches || getMenuHidden()) (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus();
        else document.getElementById('tempo-hide-menu')?.focus();
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
      if (mobileOpen && !target.closest('#tempo-sidebar')) return;
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
    window.dispatchEvent(new Event('tempo-menu-changed'));
    requestAnimationFrame(() => {
      if (hidden) (window.matchMedia('(max-width: 767px)').matches ? menuButtonRef : desktopMenuButtonRef).current?.focus();
      else document.getElementById('tempo-hide-menu')?.focus();
    });
  };

  // Riding, the Ride home and the small Send to Wattonaut window are full-bleed: no sidebar, top bar or bottom nav.
  if (/^\/athlete\/ride(?:\/\d+|\/send)?\/?$/.test(pathname)) {
    return <div id="main" tabIndex={-1} className="ink-studio-app outline-none">{children}</div>;
  }

  return (
    <div
      className="ink-studio-app tempo-shell relative min-h-screen bg-[var(--background)] text-[var(--text-secondary)]"
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
        className="relative z-10 with-sidebar min-w-0 pb-[calc(var(--mobile-nav-clearance)+1rem)] md:pb-0"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
      >
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur-md md:hidden">
          <Link href={navItems[0]?.href ?? '/'} aria-label="Wattonaut home" className={`flex min-h-11 items-center gap-2.5 rounded-lg hover:bg-[var(--raised)] ${buttonFocusClassName}`}>
            <BrandMark />
            <BrandName />
          </Link>
          <button
            type="button"
            aria-controls="tempo-sidebar"
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
        <div className="tempo-menu-bar">
          <button
            type="button"
            aria-controls="tempo-sidebar"
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
      <nav
        aria-label="Primary navigation"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--nav-border)] bg-[var(--background)]/95 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      >
        <div className="grid px-2 pt-1.5" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map((item) => {
            const isActive = isNavigationItemActive(navigationPathname, item, navItems);
            const Icon = navIconFor(item.label);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors ${buttonFocusClassName} ${
                  isActive
                    ? 'bg-[var(--nav-active)] text-[var(--text)] hover:bg-[var(--selection)]'
                    : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--text)]'
                }`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.5} className={isActive ? 'text-[var(--brand)]' : ''} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
