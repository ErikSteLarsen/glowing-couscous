/** The Tempo mark: a single trace rising through a square, like a pace line. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 10.5h3l1.8-5 3 7.5 1.8-4.5h3.4" />
      </svg>
    </span>
  );
}
