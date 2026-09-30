'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Activity, CalendarDays, Dumbbell, House, LayoutTemplate, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { StravaActivityNotifications } from '@/components/StravaActivityNotifications';
import { buttonFocusClassName, secondaryButtonClassName } from '@/components/ui';
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
        if (mediaQuery.matches || getMenuHidden()) menuButtonRef.current?.focus();
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
        requestAnimationFrame(() => menuButtonRef.current?.focus());
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

  const closeMobileMenu = () => {
    setMobileOpenPath(null);
    if (mobileOpen) requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const setDesktopMenuHidden = (hidden: boolean) => {
    sessionMenuHidden = hidden;
    try { window.localStorage.setItem('tempo-menu-hidden', String(hidden)); }
    catch { menuStorageUnavailable = true; }
    window.dispatchEvent(new Event('tempo-menu-changed'));
    requestAnimationFrame(() => {
      if (hidden) menuButtonRef.current?.focus();
      else document.getElementById('tempo-hide-menu')?.focus();
    });
  };

  return (
    <div
      className="ink-studio-app tempo-shell relative min-h-screen bg-[var(--background)] text-[var(--text)]"
      data-menu-hidden={menuHidden}
    >
      <AppSidebar
        user={user}
        pathname={navigationPathname}
        mobileOpen={mobileOpen}
        isMobileViewport={isMobileViewport}
        onClose={closeMobileMenu}
        onHide={() => setDesktopMenuHidden(true)}
        previewMode={false}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div
        className="relative z-10 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
      >
        <div className="tempo-menu-bar">
          <button
            type="button"
            aria-controls="tempo-sidebar"
            aria-expanded={isMobileViewport ? mobileOpen : !menuHidden}
            ref={menuButtonRef}
            className={`${secondaryButtonClassName} min-h-11`}
            onClick={() => isMobileViewport ? setMobileOpenPath(pathname) : setDesktopMenuHidden(false)}
          >
            <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={1.8} />
            Show menu
          </button>
        </div>
        {children}
      </div>
      <nav
        aria-label="Primary navigation"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--nav-border)] bg-[var(--nav-surface)] pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="grid grid-cols-4 gap-1 px-3 pt-2">
          {navItems.map((item) => {
            const isActive = isNavigationItemActive(navigationPathname, item, navItems);
            const Icon = item.label === 'Home'
              ? House
              : item.label === 'Plan'
                ? CalendarDays
                : item.label === 'Workouts'
                  ? Dumbbell
                  : item.label === 'Templates'
                    ? LayoutTemplate
                    : Activity;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${buttonFocusClassName} ${
                  isActive ? 'bg-[var(--nav-active)] text-[var(--nav-signal)]' : 'text-[var(--nav-muted)]'
                }`}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <StravaActivityNotifications key={user.id} paused={mobileOpen} />
    </div>
  );
}
