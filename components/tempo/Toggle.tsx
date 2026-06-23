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
      className={`inline-flex min-h-11 w-[52px] items-center rounded-full p-1 transition ${
        checked ? 'bg-[var(--brand)]' : 'bg-[#D8D1C4]'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition ${
          checked ? 'translate-x-[28px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
