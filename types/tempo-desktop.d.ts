/** Bridge exposed by the Tempo Ride desktop app (Electron preload). Absent in browsers. */
export type TempoDesktopRecording = { key: string; savedAt: string; json: string };

export type TempoDesktopBridge = {
  isDesktop: true;
  version: string;
  saveRecording(key: string, json: string): Promise<void>;
  listRecordings(): Promise<TempoDesktopRecording[]>;
  deleteRecording(key: string): Promise<void>;
  /** Absent in app versions that block the YouTube player (0.2.2 and earlier). */
  youtube?: TempoDesktopYouTube;
};

export type TempoDesktopYouTube = {
  /** Opens this site's Send to Tempo bookmark page in the system browser. */
  openBookmarkPage(): Promise<void>;
  /** Called with a video sent by a `tempo-ride://video` link. Returns an unsubscribe function. */
  onVideo(callback: (video: { url: string; startSec: number }) => void): () => void;
};

declare global {
  interface Window {
    tempoDesktop?: TempoDesktopBridge;
  }
}
