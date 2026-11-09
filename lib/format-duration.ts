export function formatDuration(durationSec: number) {
  const totalSeconds = Math.round(durationSec);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const remainder = seconds > 0 ? ` ${seconds}s` : '';

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m${remainder}`;
  }

  if (minutes > 0) return `${minutes}m${remainder}`;
  return seconds > 0 ? `${seconds}s` : '0m';
}
