import { redirect } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Settings"
        title="App settings"
        description="System-level preferences will grow here over time."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Surface>
          <h2 className="text-lg font-semibold text-white">Units</h2>
          <p className="mt-2 text-sm text-slate-300">
            Metric and imperial preferences (kilometer vs mile) will be added here in a later
            schema-backed pass.
          </p>
        </Surface>
        <Surface>
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <p className="mt-2 text-sm text-slate-300">
            Notification preferences will be added here in a later schema-backed pass.
          </p>
        </Surface>
      </div>
    </PageShell>
  );
}
