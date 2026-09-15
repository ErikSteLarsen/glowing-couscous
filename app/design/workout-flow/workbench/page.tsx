import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'Tempo / Workout flow / Workbench',
  description: 'Workbench direction preview for a durable workout editor.',
};

export default function WorkoutWorkbenchPage() {
  return <WorkoutFlowPreviews direction="workbench" />;
}
