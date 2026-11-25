import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'Wattonaut / Workout flow / Flowline',
  description: 'Flowline direction preview for a more understandable workout builder.',
};

export default function WorkoutFlowlinePage() {
  return <WorkoutFlowPreviews direction="flowline" />;
}
