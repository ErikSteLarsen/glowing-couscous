'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Bike, Check, ChevronDown, Clapperboard, Gauge, Popcorn, X } from 'lucide-react';
import { buttonFocusClassName } from '@/components/ui';
import type { EntertainmentMode } from './types';

type Choice = EntertainmentMode | 'off';

const CHOICES: { id: Choice; label: string; Icon: typeof Bike }[] = [
  { id: 'off', label: 'Data only', Icon: Gauge },
  { id: 'youtube', label: 'YouTube', Icon: Clapperboard },
  { id: 'course', label: 'Ride a course', Icon: Bike },
];

/**
 * The header's entertainment control: a menu of views, and a button straight back to the data
 * screen while one is on. The menu is kept short enough to end above the YouTube player, which
 * nothing may cover.
 */
export function EntertainmentMenu({ value, open, onOpenChange, onChoose }: {
  value: Choice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: Choice) => void;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const on = value !== 'off';
  const current = CHOICES.find(({ id }) => id === value);
  const ButtonIcon = on && current ? current.Icon : Popcorn;

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onOpenChange]);

  function close() {
    onOpenChange(false);
    buttonRef.current?.focus();
  }

  function choose(choice: Choice) {
    close();
    onChoose(choice);
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      onOpenChange(false);
      return;
    }
    // The ride's own shortcuts wait while the menu is open.
    event.stopPropagation();
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const targets: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in targets) {
      event.preventDefault();
      items[targets[event.key]].focus();
    } else if (event.key === 'Escape' || event.key.toLowerCase() === 'v') {
      event.preventDefault();
      close();
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative flex shrink-0"
      onBlur={(event) => {
        // A click into the player moves focus to its frame without a pointer event here.
        if (open && event.relatedTarget === null && document.activeElement instanceof HTMLIFrameElement) onOpenChange(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={on ? `Entertainment: ${current?.label}` : 'Entertainment'}
        title="Choose entertainment (V turns it on or off)"
        className={`inline-flex h-10 items-center gap-2 border px-3 text-sm font-medium transition-colors ${buttonFocusClassName} ${on ? 'rounded-l-lg border-[var(--brand)] text-[var(--text)]' : 'rounded-lg border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]'}`}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <ButtonIcon aria-hidden="true" size={16} strokeWidth={1.7} />
        {on ? current?.label : 'Entertainment'}
        <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {on ? (
        <button
          type="button"
          aria-label="Back to data only"
          aria-keyshortcuts="V"
          title="Back to data only (V)"
          className={`inline-flex size-10 items-center justify-center rounded-r-lg border border-l-0 border-[var(--brand)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName}`}
          onClick={() => {
            onOpenChange(false);
            onChoose('off');
          }}
        >
          <X aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
      ) : null}
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Entertainment"
          className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow-overlay)]"
          onKeyDown={onMenuKeyDown}
        >
          {CHOICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={value === id}
              tabIndex={-1}
              className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] hover:bg-[var(--raised)] ${buttonFocusClassName} ${value === id ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}
              onClick={() => choose(id)}
            >
              <Icon aria-hidden="true" size={15} strokeWidth={1.7} />
              <span className="flex-1">{label}</span>
              {value === id ? <Check aria-hidden="true" size={15} strokeWidth={2} className="text-[var(--brand)]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
