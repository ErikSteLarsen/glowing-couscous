import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth-session';
import { isShareAction, isShareToken } from '@/lib/share-link';
import { shareLinkService } from '@/lib/share-link-service';
import { EmptyState } from '@/components/ui';
import { ShareLandingClient } from './ShareLandingClient';

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
    return <EmptyState title="Shared workout unavailable" description="This link is invalid, deleted, or no longer available." />;
  }

  const user = await getCurrentUser();
  return (
    <ShareLandingClient
      token={token}
      projection={projection}
      isSignedIn={Boolean(user)}
      userRole={user?.role ?? null}
      initialAction={isShareAction(action) ? action : null}
    />
  );
}
