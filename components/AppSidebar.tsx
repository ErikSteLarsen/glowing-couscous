'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Circle,
  ClipboardList,
  Dumbbell,
  History as HistoryIcon,
  House,
  LayoutTemplate,
  Moon,
  PanelLeftClose,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';
import { buttonFocusClassName } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';

const navIcons: Record<string, LucideIcon> = {
  History: HistoryIcon,
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
  onHide: () => void;
  previewMode?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
      ).filter((element) => element.getClientRects().length > 0);
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
          className="fixed inset-0 z-40 bg-[var(--overlay)] md:hidden"
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
            className={`tempo-sidebar fixed inset-y-0 left-0 z-50 w-[228px] max-w-[calc(100vw-3rem)] overflow-y-auto border-r border-[var(--nav-border)] bg-[var(--nav-surface)] text-[var(--nav-text)] transition-transform duration-200 motion-reduce:transition-none md:sticky md:top-0 md:z-40 md:h-screen md:max-h-screen md:self-start md:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
         <div className="flex min-h-full flex-col gap-7 p-4">
           <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nav-border)] px-2 pb-5 pt-2">
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
              aria-label="Hide menu"
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-text)] ${buttonFocusClassName} md:hidden`}
              onClick={props.onClose}
            >
              <X aria-hidden="true" size={18} />
            </button>
            <button
              id="tempo-hide-menu"
              type="button"
              aria-controls="tempo-sidebar"
              aria-expanded="true"
              className={`hidden min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[12px] font-semibold text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-text)] ${buttonFocusClassName} md:flex`}
              onClick={props.onHide}
            >
              <PanelLeftClose aria-hidden="true" size={18} strokeWidth={1.8} />
              Hide menu
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
                       className={`relative flex min-h-11 items-center rounded-[10px] px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition md:min-h-10 ${
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
            {!props.previewMode ? <button
              type="button"
              onClick={props.onToggleTheme}
              aria-label={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} theme`}
              className="mb-5 flex min-h-11 w-full items-center gap-3 rounded-[10px] border border-[var(--nav-border)] px-3 text-left text-[12px] font-semibold text-[var(--nav-text)] transition hover:border-[var(--nav-signal)] hover:bg-[var(--nav-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nav-signal)]"
            >
              {props.theme === 'dark' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
              {props.theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button> : null}
            <AppProfileMenu user={props.user} pathname={props.pathname} onNavigate={props.onClose} previewMode={props.previewMode} />
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
