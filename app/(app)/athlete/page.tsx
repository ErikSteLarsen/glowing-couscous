import { redirect } from 'next/navigation';
import { FocusHome } from '@/components/FocusHome';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const dashboard = await athleteService.loadHomeDashboard(user.id);
  if (!dashboard) redirect('/login');

  return <FocusHome dashboard={dashboard} />;
}
