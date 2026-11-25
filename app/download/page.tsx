import type { Metadata } from 'next';
import { PageShell, TopBar } from '@/components/ui';
import { RideDownloadPage } from '@/components/RideDownloadPage';

export const metadata: Metadata = {
  title: 'Download Wattonaut Ride',
  description: 'Wattonaut Ride for Windows, macOS and Linux: indoor bike workouts with your Bluetooth trainer.',
};

export default function DownloadPage() {
  return (
    <PageShell size="narrow">
      <TopBar
        title="Wattonaut Ride for desktop"
        description="Ride your Wattonaut workouts on an indoor bike, with trainer control, power, heart rate and cadence over Bluetooth."
      />
      <RideDownloadPage />
    </PageShell>
  );
}
