import { redirect } from 'next/navigation';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  redirect('/athlete');
}
