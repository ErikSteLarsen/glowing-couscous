import { AtlasWorkoutPreview } from '@/components/design/AtlasPreviews';

export function generateStaticParams() {
  return ['tempo-build', 'morning-aerobic', 'long-aerobic'].map((sourceId) => ({ sourceId }));
}

export const metadata = {
  title: 'Tempo / Planner / Workout preview',
  description: 'Exact workout preview reached from the selected-day assignment rail.',
};

export default async function AtlasWorkoutPage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return <AtlasWorkoutPreview sourceId={sourceId} />;
}
