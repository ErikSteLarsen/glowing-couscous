/** Bridge exposed by the Tempo Ride desktop app (Electron preload). Absent in browsers. */
export type TempoDesktopRecording = { key: string; savedAt: string; json: string };

export type TempoDesktopBridge = {
  isDesktop: true;
  version: string;
  saveRecording(key: string, json: string): Promise<void>;
  listRecordings(): Promise<TempoDesktopRecording[]>;
  deleteRecording(key: string): Promise<void>;
  /** The app's own YouTube window, where the rider browses signed in. Absent in older app versions. */
  youtube?: TempoDesktopYouTube;
};

export type TempoDesktopYouTube = {
  /** Open (or focus) the YouTube window. */
  open(): Promise<void>;
  /** Called when the rider opens a video in the YouTube window. Returns an unsubscribe function. */
  onVideo(callback: (video: { url: string; startSec: number }) => void): () => void;
};

declare global {
  interface Window {
    tempoDesktop?: TempoDesktopBridge;
  }
}
