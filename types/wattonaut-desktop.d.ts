/** Bridge exposed by the Wattonaut Ride desktop app (Electron preload). Absent in browsers. */
export type WattonautDesktopRecording = { key: string; savedAt: string; json: string };

export type WattonautDesktopBridge = {
  isDesktop: true;
  version: string;
  saveRecording(key: string, json: string): Promise<void>;
  listRecordings(): Promise<WattonautDesktopRecording[]>;
  deleteRecording(key: string): Promise<void>;
  /** Absent in app versions that block the YouTube player (0.2.2 and earlier). */
  youtube?: WattonautDesktopYouTube;
};

export type WattonautDesktopYouTube = {
  /** Opens this site's Send to Wattonaut bookmark page in the system browser. */
  openBookmarkPage(): Promise<void>;
  /** Called with a video sent by a `tempo-ride://video` link. Returns an unsubscribe function. */
  onVideo(callback: (video: { url: string; startSec: number }) => void): () => void;
};

declare global {
  interface Window {
    tempoDesktop?: WattonautDesktopBridge;
  }
}
