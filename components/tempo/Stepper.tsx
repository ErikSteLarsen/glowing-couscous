import { Check } from 'lucide-react';

type StepperItem = {
  id: number | string;
  title: string;
  detail: string;
  active: boolean;
  done: boolean;
};

export function Stepper({ items }: { items: StepperItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.id} aria-current={item.active ? 'step' : undefined} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                item.done
                  ? 'bg-[var(--text)] text-[var(--background)]'
                  : item.active
                    ? 'bg-[var(--brand-tint)] text-[var(--field-selected-text)]'
                    : 'bg-[var(--sunken)] text-[var(--text-muted)]'
              }`}
            >
              {item.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </div>
            {index < items.length - 1 ? <div className="mt-1 h-8 w-px bg-[var(--border)]" /> : null}
          </div>
          <div
            className={`flex-1 rounded-[10px] border px-4 py-3 ${
            item.active ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-secondary)]">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
