'use client';

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`inline-flex min-h-11 w-[52px] items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-[var(--brand)]' : 'bg-[#D8D1C4]'}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
