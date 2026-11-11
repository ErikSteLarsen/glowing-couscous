export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2).replace(/\.00$/, '')} km` : `${meters} m`;
}
