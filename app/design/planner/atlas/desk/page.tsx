import { AtlasPreviews } from '@/components/design/AtlasPreviews';

export const metadata = {
  title: 'Tempo / Planner / Atlas / Planning desk',
  description: 'Three-pane month planner preview with source search and selected-day detail.',
};

export default function AtlasDeskPage() {
  return <AtlasPreviews variant="desk" />;
}
