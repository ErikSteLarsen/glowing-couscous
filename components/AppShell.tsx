'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
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
  const navItems = getPrimaryNavigation(user.role, { hasActiveCoach });

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] md:grid md:grid-cols-[244px_minmax(0,1fr)]">
      <AppSidebar
        user={user}
        pathname={pathname}
        hasActiveCoach={hasActiveCoach}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 pb-20 md:pb-0">
        <div className="border-b border-[var(--border)] bg-[var(--background)] px-5 py-4 md:hidden">
          <button
            type="button"
            aria-controls="tempo-sidebar"
            aria-expanded={mobileOpen}
            className="inline-flex min-h-11 items-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)]"
            onClick={() => setMobileOpen(true)}
          >
            Open menu
          </button>
        </div>
        {children}
      </div>
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
        <div className="grid grid-cols-4 gap-1 px-3 py-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = isNavigationItemActive(pathname, item, navItems);

            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 items-center justify-center rounded-[10px] px-3 text-[11px] font-semibold ${
                  isActive ? 'bg-[var(--brand-tint)] text-[var(--field-selected-text)]' : 'text-[var(--text-muted)]'
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
