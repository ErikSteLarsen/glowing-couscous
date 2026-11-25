import type { RideReading } from '@/lib/ride/recorder';

/** What the active ride screen hands to an entertainment view. Updated about four times a second. */
export type EntertainmentRide = {
  sessionId: number;
  /** The signed-in account, for per-account storage such as Recently played. */
  userId: number;
  status: 'running' | 'paused';
  /** A dialog (Connections, the phone's More controls sheet) covers the stage. */
  obscured: boolean;
  /** Latest live sensor reading (null fields when a sensor is missing). */
  reading: RideReading;
  /** Three-second average power, the number the ride screen shows as "Now". */
  threeSecondPowerWatts: number | null;
  /** Current power target in watts (ERG or plan), null when the block has none. */
  targetWatts: number | null;
  ergOn: boolean;
  /** "on", "under", "over" or "none", matching the ride screen's deviation tone. */
  tone: 'on' | 'under' | 'over' | 'none';
  blockLabel: string;
  /** Seconds left in the current block, null in free ride after the plan. */
  blockLeftSec: number | null;
  blockNumber: number | null;
  blockCount: number;
  /** Intensity colour of the current block (CSS colour), for accents. */
  blockColor: string;
};

export type EntertainmentMode = 'youtube' | 'course';

/** Whether leaving the current view now would interrupt something (a video playing, a course under way). */
export type ActivityCheck = () => boolean;

/** A view registers its check while it is mounted. */
export type TrackActivity = (check: ActivityCheck | null) => void;
