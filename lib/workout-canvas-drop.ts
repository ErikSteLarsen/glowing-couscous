/** Return the gap nearest the pointer, using the undisturbed workout widths. */
export function workoutCanvasDropIndex(pointerX: number, left: number, width: number, durations: number[]) {
  if (!durations.length) return 0;
  if (width <= 0) return null;

  const total = durations.reduce((sum, duration) => sum + Math.max(0, duration), 0);
  if (total <= 0) return 0;

  const position = Math.max(0, Math.min(1, (pointerX - left) / width));
  let elapsed = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = Math.max(0, durations[index]);
    if (position < (elapsed + duration / 2) / total) return index;
    elapsed += duration;
  }
  return durations.length;
}
