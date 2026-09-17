import { AtlasPreviews } from '@/components/design/AtlasPreviews';

export const metadata = {
  title: 'Tempo / Planner / Atlas / Template range',
  description: 'Month planner preview for validating template start and end dates.',
};

export default function AtlasRangePage() {
  return <AtlasPreviews variant="range" />;
}
