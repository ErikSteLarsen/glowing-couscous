'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <AppSidebar
        user={user}
        pathname={pathname}
        hasActiveCoach={hasActiveCoach}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          Menu
        </button>
        {children}
      </div>
    </div>
  );
}
