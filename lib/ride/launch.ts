/** Operating systems the Tempo Ride desktop app ships installers for. */
export type RideOs = 'windows' | 'macos' | 'linux' | 'other';

export type RideDownload = { id: string; os: Exclude<RideOs, 'other'>; label: string; fileName: string; url: string };

/** The released Tempo Ride version the website links to. Must match `desktop/package.json` (a test enforces it). */
export const RIDE_DESKTOP_VERSION = '0.2.2';

/** Pinned to the release tag so the links never depend on which GitHub release is marked latest. */
export const DEFAULT_RIDE_DOWNLOAD_BASE = `https://github.com/ErikSteLarsen/glowing-couscous/releases/download/desktop-v${RIDE_DESKTOP_VERSION}`;

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

export type MacArchitecture = 'arm' | 'x86';

const MAC_DOWNLOAD_IDS: Record<MacArchitecture, string> = { arm: 'macos-arm64', x86: 'macos-x64' };

/** Normalizes `userAgentData` high-entropy hints to a Mac chip, or null when the browser gives no usable answer. */
export function macArchitectureFromHints(hints: { architecture?: string | null } | null | undefined): MacArchitecture | null {
  const architecture = hints?.architecture?.toLowerCase();
  if (architecture === 'arm') return 'arm';
  if (architecture === 'x86') return 'x86';
  return null;
}

/**
 * Installers split into the ones to offer first and the rest. On macOS a known chip narrows the
 * recommendation to one .dmg; without a hint both are recommended, Apple silicon first.
 */
export function rideDownloadChoices(os: RideOs, base = DEFAULT_RIDE_DOWNLOAD_BASE, architecture?: MacArchitecture | null): { recommended: RideDownload[]; others: RideDownload[] } {
  const all = DOWNLOADS.map((download) => ({ ...download, url: `${base}/${download.fileName}` }));
  const macChip = architecture ? MAC_DOWNLOAD_IDS[architecture] : null;
  const isRecommended = (download: RideDownload) => download.os === os && (!macChip || download.id === macChip);
  return { recommended: all.filter(isRecommended), others: all.filter((download) => !isRecommended(download)) };
}

/** Short first-run instructions for each OS; the builds are unsigned. */
export function rideInstallHints(os: RideOs): string[] {
  switch (os) {
    case 'windows':
      return [
        'Run the installer. If Windows warns about an unrecognized app, choose More info, then Run anyway.',
        'After that, Tempo can open Tempo Ride for you.',
      ];
    case 'macos':
      return [
        'Open the .dmg and drag Tempo Ride to Applications.',
        'The app isn’t signed yet. The first time, Control-click it in Applications, choose Open, then choose Open again.',
      ];
    case 'linux':
      return [
        'AppImage: move it to a folder you keep (for example ~/Applications), make it executable with chmod +x Tempo-Ride-Linux.AppImage, then open it once. After that, Tempo can open it for you.',
        'Or install the .deb with sudo apt install ./Tempo-Ride-Linux.deb.',
        'Allow Bluetooth access when asked. Your Linux user may need to be in the bluetooth group.',
      ];
    default:
      return ['Tempo Ride runs on Windows, macOS and Linux. On this device, ride in your browser instead.'];
  }
}

export function rideSessionPath(sessionId: number, from?: string): string {
  return `/athlete/ride/${sessionId}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
}

export function rideAppLink(rideUrl: string): string {
  return `tempo-ride://open?url=${encodeURIComponent(rideUrl)}`;
}

export const RIDE_APP_LAUNCH_TIMEOUT_MS = 1500;
