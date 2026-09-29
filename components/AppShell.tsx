'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Activity, CalendarDays, Dumbbell, House, LayoutTemplate } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
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

export function AppShell({
  user,
  children,
}: {
  user: SessionUser & { role: 'COACH' | 'ATHLETE' };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigationPathname = pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getClientTheme, getServerTheme);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = getMobileNavigation(user.role);

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
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
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
        setMobileOpen(false);
        menuButtonRef.current?.focus();
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
    setMobileOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  return (
    <div
      className="ink-studio-app relative min-h-screen bg-[var(--background)] text-[var(--text)] md:grid md:grid-cols-[228px_minmax(0,1fr)]"
    >
      <AppSidebar
        user={user}
        pathname={navigationPathname}
        mobileOpen={mobileOpen}
        isMobileViewport={isMobileViewport}
        onClose={closeMobileMenu}
        previewMode={false}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div
        className="relative z-10 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
        aria-hidden={mobileOpen && isMobileViewport ? true : undefined}
        inert={mobileOpen && isMobileViewport ? true : undefined}
      >
        <div className="border-b border-[var(--border)] bg-[var(--background)] px-5 py-4 md:hidden">
          <button
            type="button"
            aria-controls="tempo-sidebar"
            aria-expanded={mobileOpen}
            ref={menuButtonRef}
            className={secondaryButtonClassName}
            onClick={() => setMobileOpen(true)}
          >
            Open menu
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
    </div>
  );
}
