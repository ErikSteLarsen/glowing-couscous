import { PlannerPreviews } from '@/components/design/PlannerPreviews';

export const metadata = {
  title: 'Tempo / Planner / Dispatch',
  description: 'Dispatch direction preview for multi-day planner assignment.',
};

export default function PlannerDispatchPage() {
  return <PlannerPreviews variant="dispatch" />;
}
