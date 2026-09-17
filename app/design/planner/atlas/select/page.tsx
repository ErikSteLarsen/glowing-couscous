import { AtlasPreviews } from '@/components/design/AtlasPreviews';

export const metadata = {
  title: 'Tempo / Planner / Atlas / Select days',
  description: 'Month planner preview for selecting multiple workout dates.',
};

export default function AtlasSelectPage() {
  return <AtlasPreviews variant="select" />;
}
