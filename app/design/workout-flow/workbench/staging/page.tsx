import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'TempoBuilder / Workout flow / Workbench / Staging',
  description: 'Workbench staging direction preview for assembling repeated blocks before finalizing.',
};

export default function WorkoutWorkbenchStagingPage() {
  return <WorkoutFlowPreviews direction="workbench" workbenchVariant="staging" />;
}
