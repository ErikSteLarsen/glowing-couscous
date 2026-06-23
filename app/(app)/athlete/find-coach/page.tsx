import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { FindCoachClient } from './FindCoachClient';

export default async function FindCoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const state = await athleteService.loadCoachSearchState(user.id);
  if (state.profile) redirect('/athlete');

  return <FindCoachClient initialState={state} />;
}
