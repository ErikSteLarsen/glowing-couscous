import type { Metadata } from 'next';
import { PageShell, TopBar } from '@/components/ui';
import { RideDownloadPage } from '@/components/RideDownloadPage';

export const metadata: Metadata = {
  title: 'Download Tempo Ride',
  description: 'Tempo Ride for Windows, macOS and Linux: indoor bike workouts with your Bluetooth trainer.',
};

export default function DownloadPage() {
  return (
    <PageShell size="narrow">
      <TopBar
        title="Tempo Ride for desktop"
        description="Ride your Tempo workouts on an indoor bike, with trainer control, power, heart rate and cadence over Bluetooth."
      />
      <RideDownloadPage />
    </PageShell>
  );
}
