import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth-session';
import { isShareAction, isShareToken } from '@/lib/share-link';
import { shareLinkService } from '@/lib/share-link-service';
import { EmptyState } from '@/components/ui';
import { ShareLandingClient } from './ShareLandingClient';
import { accountService } from '@/lib/account-service';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { token } = await params;
  const { action } = await searchParams;
  const projection = await shareLinkService.loadPreview(token);
  if (!projection || !isShareToken(token)) {
    return <EmptyState title="This shared workout isn’t available" description="The link may be wrong, or it was turned off." />;
  }

  const user = await getCurrentUser();
  const account = user ? await accountService.getAccount(user.id) : null;
  return (
    <ShareLandingClient
      token={token}
      projection={projection}
      ownerDeleted={projection.ownerDeleted}
      isSignedIn={Boolean(user)}
      userRole={user?.role ?? null}
      initialAction={isShareAction(action) ? action : null}
      performanceProfile={account?.performanceProfile}
    />
  );
}
