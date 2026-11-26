import type { Metadata } from 'next';
import { PageShell, TopBar } from '@/components/ui';
import { RideDownloadPage } from '@/components/RideDownloadPage';

export const metadata: Metadata = {
  title: 'Download TempoBuilder Ride',
  description: 'TempoBuilder Ride for Windows, macOS and Linux: indoor bike workouts with your Bluetooth trainer.',
};

export default function DownloadPage() {
  return (
    <PageShell size="narrow">
      <TopBar
        title="TempoBuilder Ride for desktop"
        description="Ride your TempoBuilder workouts on an indoor bike, with trainer control, power, heart rate and cadence over Bluetooth."
      />
      <RideDownloadPage />
    </PageShell>
  );
}
