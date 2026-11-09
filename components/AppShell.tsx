'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AppSidebar, navIconFor } from '@/components/AppSidebar';
import { BrandMark } from '@/components/BrandMark';
import { buttonFocusClassName } from '@/components/ui';
import { getMobileNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import type { SessionUser } from '@/lib/auth-session';

export function AppShell({
  user,
  hasActiveCoach,
  children,
}: {
  user: SessionUser & { role: 'COACH' | 'ATHLETE' };
  hasActiveCoach: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = getMobileNavigation(user.role, { hasActiveCoach });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
      // A drawer left open while widening to desktop would keep the page scroll-locked.
      if (!mediaQuery.matches) setMobileOpen(false);
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
    if (!mobileOpen) return;
    setMobileOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  // After choosing a destination, focus belongs to the new page rather than the menu button.
  const closeAfterNavigation = () => {
    if (!mobileOpen) return;
    setMobileOpen(false);
    requestAnimationFrame(() => document.getElementById('main')?.focus());
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-secondary)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--signal-ink)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <AppSidebar
        user={user}
        pathname={pathname}
        hasActiveCoach={hasActiveCoach}
        mobileOpen={mobileOpen}
        isMobileViewport={isMobileViewport}
        onClose={closeMobileMenu}
        onNavigate={closeAfterNavigation}
      />
      <div className="with-sidebar min-w-0 pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur-md md:hidden">
          <Link href={navItems[0]?.href ?? '/'} className={`flex items-center gap-2.5 rounded-lg ${buttonFocusClassName}`}>
            <BrandMark />
            <span className="text-[15px] font-semibold text-[var(--text)]">Tempo</span>
          </Link>
          <button
            type="button"
            aria-controls="tempo-sidebar"
            aria-expanded={mobileOpen}
            aria-label="Open menu"
            ref={menuButtonRef}
            className={`inline-flex size-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName}`}
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" size={18} strokeWidth={1.6} />
          </button>
        </header>
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--nav-border)] bg-[var(--background)]/95 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      >
        <div className="grid px-2 pt-1.5" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map((item) => {
            const isActive = isNavigationItemActive(pathname, item, navItems);
            const Icon = navIconFor(item.label);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors ${buttonFocusClassName} ${
                  isActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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
