'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarDays,
  Circle,
  ClipboardList,
  Dumbbell,
  History as HistoryIcon,
  House,
  LayoutTemplate,
  Moon,
  PanelLeftClose,
  Search,
  Sun,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';
import { BrandMark } from '@/components/BrandMark';
import { buttonFocusClassName } from '@/components/ui';

const navIcons: Record<string, LucideIcon> = {
  Athletes: UsersRound,
  Activity,
  Calendar: CalendarDays,
  Coach: Search,
  History: HistoryIcon,
  Home: House,
  Import: Upload,
  Planner: ClipboardList,
  Templates: LayoutTemplate,
  Workouts: Dumbbell,
};

export function navIconFor(label: string) {
  return navIcons[label] ?? Circle;
}

export function AppSidebar(props: {
  user: { name: string; email: string; role: 'COACH' | 'ATHLETE' };
  pathname: string;
  mobileOpen: boolean;
  isMobileViewport: boolean;
  onClose: () => void;
  onNavigate?: () => void;
  /** Desktop only: hides the whole sidebar; the shell shows a restore control. */
  onHide?: () => void;
  previewMode?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}) {
  const navItems = getPrimaryNavigation();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onNavigate = props.onNavigate ?? props.onClose;

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
          aria-label="Close menu"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-[var(--overlay)] backdrop-blur-[2px] md:hidden"
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
        className={`tempo-sidebar app-sidebar fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto overflow-x-hidden border-r border-[var(--nav-border)] bg-[var(--nav-surface)] text-[var(--nav-text)] transition-transform duration-200 md:visible md:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex min-h-full flex-col gap-6 px-3 py-4">
          <div className="flex min-h-9 items-center justify-between gap-2 px-1">
            <Link
              href={navItems[0]?.href ?? '/'}
              onClick={onNavigate}
              className={`flex min-w-0 items-center gap-2.5 rounded-lg ${buttonFocusClassName}`}
              aria-label="Tempo home"
            >
              <BrandMark />
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">Tempo</span>
              {props.user.role === 'COACH' ? (
                <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  Coach
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              ref={closeButtonRef}
              aria-label="Close menu"
              className={`inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)] md:hidden ${buttonFocusClassName}`}
              onClick={props.onClose}
            >
              <X aria-hidden="true" size={16} strokeWidth={1.6} />
            </button>
            {props.onHide ? (
              <button
                id="tempo-hide-menu"
                type="button"
                aria-label="Hide menu"
                title="Hide menu"
                aria-controls="tempo-sidebar"
                aria-expanded="true"
                className={`hidden size-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] md:flex ${buttonFocusClassName}`}
                onClick={props.onHide}
              >
                <PanelLeftClose aria-hidden="true" size={16} strokeWidth={1.5} />
              </button>
            ) : null}
          </div>

          <nav aria-label="Primary" className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = isNavigationItemActive(props.pathname, item, navItems);
              const Icon = navIconFor(item.label);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-2.5 text-sm transition-colors md:min-h-9 ${buttonFocusClassName} ${
                    isActive
                      ? 'bg-[var(--nav-active)] text-[var(--text)]'
                      : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    size={16}
                    strokeWidth={1.5}
                    className={`shrink-0 ${isActive ? 'text-[var(--nav-signal)]' : ''}`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            {!props.previewMode && props.onToggleTheme ? (
              <button
                type="button"
                onClick={props.onToggleTheme}
                aria-label={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} theme`}
                title={props.theme === 'dark' ? 'Light theme' : 'Dark theme'}
                className={`hidden min-h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--nav-active)] hover:text-[var(--text)] md:flex ${buttonFocusClassName}`}
              >
                {props.theme === 'dark' ? <Sun aria-hidden="true" size={16} strokeWidth={1.5} /> : <Moon aria-hidden="true" size={16} strokeWidth={1.5} />}
                <span>{props.theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
              </button>
            ) : null}
            <AppProfileMenu user={props.user} pathname={props.pathname} onNavigate={onNavigate} previewMode={props.previewMode} />
          </div>
        </div>
      </aside>
    </>
  );
}
