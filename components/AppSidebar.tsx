'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarDays,
  Circle,
  ClipboardList,
  Dumbbell,
  House,
  LayoutTemplate,
  Upload,
} from 'lucide-react';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';
import { compactSecondaryButtonClassName } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';

const navIcons: Record<string, LucideIcon> = {
  Activity,
  Calendar: CalendarDays,
  Home: House,
  Planner: ClipboardList,
  Templates: LayoutTemplate,
  Workouts: Dumbbell,
  Import: Upload,
};

export function AppSidebar(props: {
  user: { name: string; email: string; role: 'COACH' | 'ATHLETE' };
  pathname: string;
  mobileOpen: boolean;
  isMobileViewport: boolean;
  onClose: () => void;
}) {
  const navItems = getPrimaryNavigation();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!props.isMobileViewport || !props.mobileOpen) return;

    closeButtonRef.current?.focus();
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    sidebar.addEventListener('keydown', handleTab);
    return () => sidebar.removeEventListener('keydown', handleTab);
  }, [props.isMobileViewport, props.mobileOpen]);

  return (
    <>
      {props.mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-[var(--overlay)] md:hidden"
          onClick={props.onClose}
        />
      ) : null}
        <aside
           id="tempo-sidebar"
           aria-label="Workspace"
           role={props.isMobileViewport && props.mobileOpen ? 'dialog' : undefined}
           aria-hidden={props.isMobileViewport && !props.mobileOpen ? true : undefined}
           aria-modal={props.isMobileViewport && props.mobileOpen ? true : undefined}
           inert={props.isMobileViewport && !props.mobileOpen ? true : undefined}
           ref={sidebarRef}
            className={`fixed inset-y-0 left-0 z-40 w-[216px] overflow-y-auto border-r border-[var(--nav-border)] bg-[var(--nav-surface)] text-[var(--nav-text)] transition-transform duration-200 md:sticky md:top-0 md:h-screen md:max-h-screen md:self-start md:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
         <div className="flex min-h-full flex-col gap-7 p-4">
           <div className="flex items-start justify-between gap-3 border-b border-[var(--nav-border)] px-2 pb-7 pt-2">
             <div className="flex items-center gap-3">
                <div className="ink-brand-mark" aria-hidden="true">
                  <span />
                  <i />
               </div>
               <div>
                  <p className="text-[15px] font-semibold uppercase tracking-[0.28em] text-[var(--nav-text)]">Tempo</p>
              </div>
            </div>
            <button
              type="button"
              ref={closeButtonRef}
                className={`${compactSecondaryButtonClassName} md:hidden`}
              onClick={props.onClose}
            >
              Close
            </button>
          </div>

           <div>
              <p className="px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--nav-muted)]">Workspace</p>
             <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const isActive = isNavigationItemActive(props.pathname, item, navItems);
                return (
                   <Link
                     key={item.href}
                     href={item.href}
                     onClick={props.onClose}
                     aria-current={isActive ? 'page' : undefined}
                       className={`relative flex min-h-11 items-center rounded-[3px] px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition md:min-h-10 ${
                      isActive
                         ? 'bg-[var(--nav-active)] text-[var(--nav-text)]'
                         : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-text)]'
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-[var(--nav-signal)]" />
                    ) : null}
                     <span className="flex min-w-0 items-center gap-3">
                       <NavigationIcon label={item.label} />
                       <span className="block">{item.label}</span>
                     </span>
                  </Link>
                );
              })}
             </nav>
           </div>

           <div className="mt-auto">
            <AppProfileMenu user={props.user} pathname={props.pathname} onNavigate={props.onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}

function NavigationIcon({ label }: { label: string }) {
  const Icon = navIcons[label] ?? Circle;
  return <Icon aria-hidden="true" size={15} strokeWidth={1.5} />;
}
