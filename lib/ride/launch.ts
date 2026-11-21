/** Operating systems the Tempo Ride desktop app ships installers for. */
export type RideOs = 'windows' | 'macos' | 'linux' | 'other';

export type RideDownload = { id: string; os: Exclude<RideOs, 'other'>; label: string; fileName: string; url: string };

export const DEFAULT_RIDE_DOWNLOAD_BASE = 'https://github.com/ErikSteLarsen/glowing-couscous/releases/latest/download';

const DOWNLOADS: Array<Omit<RideDownload, 'url'>> = [
  { id: 'windows', os: 'windows', label: 'Windows installer', fileName: 'Tempo-Ride-Windows-Setup.exe' },
  { id: 'macos-arm64', os: 'macos', label: 'macOS (Apple silicon)', fileName: 'Tempo-Ride-macOS-arm64.dmg' },
  { id: 'macos-x64', os: 'macos', label: 'macOS (Intel)', fileName: 'Tempo-Ride-macOS-x64.dmg' },
  { id: 'linux-appimage', os: 'linux', label: 'Linux AppImage', fileName: 'Tempo-Ride-Linux.AppImage' },
  { id: 'linux-deb', os: 'linux', label: 'Linux .deb (Debian, Ubuntu)', fileName: 'Tempo-Ride-Linux.deb' },
];

export type OsHints = { platform?: string | null; userAgent?: string | null; maxTouchPoints?: number };

/** Detects the desktop OS from `navigator.userAgentData.platform` or the user agent. Phones and tablets are `other`. */
export function detectRideOs({ platform, userAgent, maxTouchPoints = 0 }: OsHints): RideOs {
  const ua = userAgent ?? '';
  if (/android|iphone|ipad|ipod|cros|windows phone|\bmobile\b/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'other';
  const source = `${platform ?? ''} ${ua}`.toLowerCase();
  if (/windows|win32|win64/.test(source)) return 'windows';
  if (/mac ?os|macintosh|mac os x/.test(source)) return 'macos';
  if (/linux|x11|ubuntu|fedora/.test(source)) return 'linux';
  return 'other';
}

/** Release asset base; a configured override wins, trailing slashes are dropped. */
export function rideDownloadBase(override?: string | null): string {
  const trimmed = override?.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_RIDE_DOWNLOAD_BASE;
}

/** All installers, with the detected OS first. On macOS, `arm` hints put Apple silicon first. */
export function rideDownloads(os: RideOs, base = DEFAULT_RIDE_DOWNLOAD_BASE, architecture?: string | null): RideDownload[] {
  const all = DOWNLOADS.map((download) => ({ ...download, url: `${base}/${download.fileName}` }));
  if (os === 'other') return all;
  const preferredMac = architecture === 'x86' ? 'macos-x64' : 'macos-arm64';
  const rank = (download: RideDownload) => download.os !== os ? 2 : os === 'macos' && download.id !== preferredMac ? 1 : 0;
  return [...all].sort((left, right) => rank(left) - rank(right));
}

/** Short first-run instructions for each OS; the builds are unsigned. */
export function rideInstallHints(os: RideOs): string[] {
  switch (os) {
    case 'windows':
      return [
        'Run the installer. Windows SmartScreen may warn about an unrecognized app: choose More info, then Run anyway.',
        'Tempo Ride registers itself to open tempo-ride:// links.',
      ];
    case 'macos':
      return [
        'Open the .dmg and drag Tempo Ride to Applications.',
        'The app is unsigned: the first time, Control-click it in Applications and choose Open, then Open again.',
      ];
    case 'linux':
      return [
        'AppImage: move it somewhere permanent (e.g. ~/Applications), chmod +x Tempo-Ride-Linux.AppImage, then open it once. It registers the tempo-ride:// link handler itself.',
        'Or install the .deb with sudo apt install ./Tempo-Ride-Linux.deb, which registers the handler for you.',
        'Allow Bluetooth access when asked (your user may need to be in the bluetooth group).',
      ];
    default:
      return ['Tempo Ride runs on Windows, macOS and Linux. On this device, ride in the browser instead.'];
  }
}

export function rideSessionPath(sessionId: number, from?: string): string {
  return `/athlete/ride/${sessionId}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
}

export function rideAppLink(rideUrl: string): string {
  return `tempo-ride://open?url=${encodeURIComponent(rideUrl)}`;
}

export const RIDE_APP_LAUNCH_TIMEOUT_MS = 1500;
