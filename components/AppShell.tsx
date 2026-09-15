'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { InkFlow } from '@/components/InkFlow';
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
    <div className="ink-studio-app relative min-h-screen bg-[var(--background)] text-[var(--text)] md:grid md:grid-cols-[216px_minmax(0,1fr)]">
      <div className="ink-flow-backdrop">
        <InkFlow />
      </div>
      <AppSidebar
        user={user}
        pathname={pathname}
        hasActiveCoach={hasActiveCoach}
        mobileOpen={mobileOpen}
        isMobileViewport={isMobileViewport}
        onClose={closeMobileMenu}
      />
      <div className="relative z-10 min-w-0 pb-20 md:pb-0">
        <div className="border-b border-[var(--border)] bg-[var(--background)] px-5 py-4 md:hidden">
          <button
            type="button"
            aria-controls="tempo-sidebar"
            aria-expanded={mobileOpen}
            ref={menuButtonRef}
            className="inline-flex min-h-11 items-center rounded-[3px] border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text)] shadow-[var(--shadow-inset)]"
            onClick={() => setMobileOpen(true)}
          >
            Open menu
          </button>
        </div>
        {children}
      </div>
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--nav-border)] bg-[var(--nav-surface)] pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="grid grid-cols-4 gap-1 px-3 pt-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = isNavigationItemActive(pathname, item, navItems);

            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                 className={`flex min-h-11 items-center justify-center rounded-[3px] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                  isActive ? 'bg-[var(--nav-active)] text-[var(--nav-signal)]' : 'text-[var(--nav-muted)]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
