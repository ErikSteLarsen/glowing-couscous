'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';

export function AppSidebar(props: {
  user: { name: string; email: string; role: 'COACH' | 'ATHLETE' };
  pathname: string;
  hasActiveCoach: boolean;
  mobileOpen: boolean;
  isMobileViewport: boolean;
  onClose: () => void;
}) {
  const navItems = getPrimaryNavigation(props.user.role, { hasActiveCoach: props.hasActiveCoach });
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
          className={`fixed inset-y-0 left-0 z-40 w-[244px] overflow-y-auto border-r border-[var(--nav-border)] bg-[var(--nav-surface)] text-[var(--nav-text)] transition-transform duration-200 md:sticky md:top-0 md:h-screen md:max-h-screen md:self-start md:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-full flex-col gap-6 p-4">
          <div className="flex items-start justify-between gap-3 px-2 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-[var(--text)]">
                <div className="h-[10px] w-[10px] rounded-[3px] bg-[var(--nav-signal)]" />
              </div>
              <div>
                <p className="text-base font-bold tracking-[-0.02em] text-[var(--nav-text)]">Tempo</p>
                {props.user.role === 'COACH' ? (
                  <span className="mt-1 inline-flex rounded-[5px] bg-[var(--nav-active)] px-2 py-1 text-[10px] font-semibold text-[var(--nav-signal)]">
                    COACH
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              ref={closeButtonRef}
              className="rounded-[10px] border border-[var(--nav-border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--nav-muted)] md:hidden"
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
                      className={`relative flex min-h-11 items-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition md:min-h-10 ${
                      isActive
                         ? 'bg-[var(--nav-active)] text-[var(--nav-text)]'
                         : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-text)]'
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-[var(--nav-signal)]" />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block">{item.label}</span>
                      {item.description ? <span className="mt-0.5 block text-[11px] font-normal text-[var(--nav-muted)]">{item.description}</span> : null}
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
