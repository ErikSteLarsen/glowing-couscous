import { ReactNode } from 'react';

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/10 bg-[#0f1729] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">{children}</div>

        <div className="mt-4 flex flex-wrap gap-3">{actions}</div>
      </div>
    </div>
  );
}
