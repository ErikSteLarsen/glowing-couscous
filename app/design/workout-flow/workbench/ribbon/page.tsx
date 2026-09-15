import { WorkoutFlowPreviews } from '@/components/design/WorkoutFlowPreviews';

export const metadata = {
  title: 'Tempo / Workout flow / Workbench / Ribbon',
  description: 'Workbench ribbon direction preview for a full-width selectable session.',
};

export default function WorkoutWorkbenchRibbonPage() {
  return <WorkoutFlowPreviews direction="workbench" workbenchVariant="ribbon" />;
}
