import { ReactNode } from 'react';
import { secondaryButtonClassName } from '@/components/ui';

type CoachEditorDrawerProps = {
  isOpen: boolean;
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
};

export function CoachEditorDrawer({
  isOpen,
  eyebrow,
  title,
  description,
  onClose,
  children,
  actions,
}: CoachEditorDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(35,34,32,0.22)] backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_80px_rgba(35,34,32,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--text)]">{title}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClassName}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">{children}</div>

        <div className="mt-4 flex flex-wrap gap-3">{actions}</div>
      </div>
    </div>
  );
}
