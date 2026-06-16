import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { SignOutButton } from '@/components/SignOutButton';

export default async function AthleteProfilePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const profileState = await athleteService.loadProfileState(user.id);
  if (profileState.profile) redirect('/athlete');

  const latestRequest = profileState.latestRequest;

  return (
    <PageShell>
      <TopBar
        eyebrow="Your profile"
        title={user.name}
        description={
          latestRequest?.status === 'PENDING'
            ? `Your request to ${latestRequest.coach.name} is still waiting for approval.`
            : latestRequest?.status === 'REJECTED'
            ? `${latestRequest.coach.name} declined your last request. You can retry the same coach or look for another one.`
            : "You don't have a coach yet. Find a coach to get your weekly training plan."
        }
        actions={
          latestRequest?.status === 'PENDING' ? (
            <SignOutButton />
          ) : (
            <>
              <ActionLink href="/athlete/find-coach">Find a coach</ActionLink>
              <SignOutButton />
            </>
          )
        }
      />
      {latestRequest?.status === 'PENDING' ? (
        <EmptyState
          title={`Waiting for ${latestRequest.coach.name}`}
          description={`Your join request is pending. We'll show your weekly plan here once ${latestRequest.coach.name} accepts it.`}
        />
      ) : latestRequest?.status === 'REJECTED' ? (
        <EmptyState
          title="Request declined"
          description={`Your last request was declined by ${latestRequest.coach.name}. Search again to retry the same coach or request a different one.`}
        />
      ) : (
        <EmptyState
          title="No training plan yet"
          description="Once a coach accepts your request, your weekly plan will appear here."
        />
      )}
    </PageShell>
  );
}
