import { PlannerPreviews } from '@/components/design/PlannerPreviews';

export const metadata = {
  title: 'Tempo / Planner / Field',
  description: 'Field direction preview for calendar-first planner assignment.',
};

export default function PlannerFieldPage() {
  return <PlannerPreviews variant="field" />;
}
