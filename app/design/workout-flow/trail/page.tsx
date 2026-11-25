import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'Wattonaut / Workout flow / Trail',
  description: 'Trail direction preview for a guided workout creation flow.',
};

export default function WorkoutTrailPage() {
  return <WorkoutFlowPreviews direction="trail" />;
}
