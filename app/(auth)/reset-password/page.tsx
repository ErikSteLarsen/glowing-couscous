import type { Metadata } from 'next';
import { PasswordResetClient } from '@/components/PasswordResetClient';

export const metadata: Metadata = {
  title: 'Reset your TempoBuilder password',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  return <PasswordResetClient token={token} />;
}
