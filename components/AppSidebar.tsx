import Link from 'next/link';
import { getPrimaryNavigation, isNavigationItemActive } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';

export function AppSidebar(props: {
  user: { name: string; email: string; role: 'COACH' | 'ATHLETE' };
  pathname: string;
  hasActiveCoach: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const navItems = getPrimaryNavigation(props.user.role, { hasActiveCoach: props.hasActiveCoach });

  return (
    <>
      {props.mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-30 bg-[rgba(35,34,32,0.16)] md:hidden"
          onClick={props.onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[244px] border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 md:static md:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col gap-6 p-4">
          <div className="flex items-start justify-between gap-3 px-2 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-[var(--text)]">
                <div className="h-[10px] w-[10px] rounded-[3px] bg-[#9CB07F]" />
              </div>
              <div>
                <p className="text-base font-bold tracking-[-0.02em] text-[var(--text)]">Tempo</p>
                {props.user.role === 'COACH' ? (
                  <span className="mt-1 inline-flex rounded-[5px] bg-[var(--brand-tint)] px-2 py-1 text-[10px] font-semibold text-[#57654E]">
                    COACH
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] md:hidden"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>

          <div>
            <p className="px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#B6B0A4]">
              {props.user.role === 'COACH' ? 'Coaching' : 'Training'}
            </p>
            <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const isActive = isNavigationItemActive(props.pathname, item, navItems);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={props.onClose}
                    className={`relative flex min-h-11 items-center rounded-[10px] px-4 text-[13.5px] font-semibold transition ${
                      isActive
                        ? 'bg-[var(--brand-tint)] text-[#2F3A28]'
                        : 'text-[var(--text-secondary)] hover:bg-[#FBFAF7]'
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-[var(--brand)]" />
                    ) : null}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto">
            <AppProfileMenu user={props.user} onNavigate={props.onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}
