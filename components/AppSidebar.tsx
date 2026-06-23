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
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
          onClick={props.onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[rgba(15,23,42,0.94)] transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0 ${
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col gap-6 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workout Planner</p>
              <p className="mt-2 text-sm text-slate-300">
                {props.user.role === 'COACH' ? 'Coach workspace' : 'Athlete workspace'}
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 lg:hidden"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = isNavigationItemActive(props.pathname, item, navItems);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={props.onClose}
                  className={
                    isActive
                      ? 'block rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white'
                      : 'block rounded-2xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <AppProfileMenu user={props.user} onNavigate={props.onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}
