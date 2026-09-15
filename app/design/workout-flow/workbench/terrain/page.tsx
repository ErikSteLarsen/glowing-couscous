import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'Tempo / Workout flow / Workbench / Terrain',
  description: 'Workbench terrain direction preview for visualizing intensity through height.',
};

export default function WorkoutWorkbenchTerrainPage() {
  return <WorkoutFlowPreviews direction="workbench" workbenchVariant="terrain" />;
}
