/** Bridge exposed by the Tempo Ride desktop app (Electron preload). Absent in browsers. */
export type TempoDesktopRecording = { key: string; savedAt: string; json: string };

export type TempoDesktopBridge = {
  isDesktop: true;
  version: string;
  saveRecording(key: string, json: string): Promise<void>;
  listRecordings(): Promise<TempoDesktopRecording[]>;
  deleteRecording(key: string): Promise<void>;
};

declare global {
  interface Window {
    tempoDesktop?: TempoDesktopBridge;
  }
}
