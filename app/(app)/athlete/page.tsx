import { redirect } from 'next/navigation';
import { FocusHome } from '@/components/FocusHome';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { accountService } from '@/lib/account-service';
import { HomeTrainingSetup } from '@/components/HomeTrainingSetup';
import { parsePrefsJson } from '@/lib/overview-preferences';
import { parseTrainingSports } from '@/lib/training-setup';

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const [dashboard, account] = await Promise.all([athleteService.loadHomeDashboard(user.id), accountService.getAccount(user.id)]);
  if (!dashboard || !account) redirect('/login');

  return <FocusHome dashboard={dashboard} trainingSetup={<HomeTrainingSetup key={account.updatedAt.toISOString()} profile={account.performanceProfile} sports={parseTrainingSports(parsePrefsJson(account.prefsJson).trainingSports)} revision={account.updatedAt.toISOString()} />} />;
}
