/** The TempoBuilder mark: a planet with a ridge that rises to the right. Paths come from `brand/kit/build.py`. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="28" height="28">
        <path className="brand-mark-sky" d="M58.91 18.73L57.98 17.00L56.94 15.33L55.80 13.74L54.56 12.22L53.21 10.79L51.78 9.44L50.26 8.20L48.67 7.06L47.00 6.02L45.27 5.09L43.48 4.28L41.64 3.59L39.76 3.02L37.85 2.58L35.92 2.26L33.96 2.06L32.00 2.00L30.04 2.06L28.08 2.26L26.15 2.58L24.24 3.02L22.36 3.59L20.52 4.28L18.73 5.09L17.00 6.02L15.33 7.06L13.74 8.20L12.22 9.44L10.79 10.79L9.44 12.22L8.20 13.74L7.06 15.33L6.02 17.00L5.09 18.73L4.28 20.52L3.59 22.36L3.02 24.24L2.58 26.15L2.26 28.08L2.06 30.04L2.02 31.45L6.29 35.89L10.82 29.66L18.08 44.20L23.14 35.01L25.89 38.22L33.19 20.50L43.75 38.61L50.94 22.32L54.73 26.66L59.23 19.45Z" />
        <path className="brand-mark-ground" d="M61.74 28.08L61.42 26.15L60.98 24.24L60.97 24.22L55.27 33.34L52.06 29.68L44.25 47.39L33.81 29.50L27.11 45.78L23.86 41.99L17.92 52.80L10.18 37.34L6.71 42.11L2.57 37.80L2.58 37.85L3.02 39.76L3.59 41.64L4.28 43.48L5.09 45.27L6.02 47.00L7.06 48.67L8.20 50.26L9.44 51.78L10.79 53.21L12.22 54.56L13.74 55.80L15.33 56.94L17.00 57.98L18.73 58.91L20.52 59.72L22.36 60.41L24.24 60.98L26.15 61.42L28.08 61.74L30.04 61.94L32.00 62.00L33.96 61.94L35.92 61.74L37.85 61.42L39.76 60.98L41.64 60.41L43.48 59.72L45.27 58.91L47.00 57.98L48.67 56.94L50.26 55.80L51.78 54.56L53.21 53.21L54.56 51.78L55.80 50.26L56.94 48.67L57.98 47.00L58.91 45.27L59.72 43.48L60.41 41.64L60.98 39.76L61.42 37.85L61.74 35.92L61.94 33.96L62.00 32.00L61.94 30.04Z" />
      </svg>
    </span>
  );
}

/** The name as set in the logo: lowercase, with "tempo" slightly bolder. Use "TempoBuilder" in running text. */
export function BrandName() {
  return (
    <span className="text-[16px] tracking-[-0.025em] text-[var(--text)]">
      <span className="font-semibold">tempo</span><span className="font-medium">builder</span>
    </span>
  );
}
