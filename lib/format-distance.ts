export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2).replace(/\.00$/, '')}\u00A0km` : `${meters}\u00A0m`;
}
