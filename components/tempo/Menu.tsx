'use client';

import type { ComponentProps } from 'react';
import { Ellipsis } from 'lucide-react';
import { overlayPanelClassName, buttonFocusClassName } from '@/components/ui';
import {
  MenuCheckboxItem as SdkCheckboxItem,
  MenuContent as SdkContent,
  MenuGroupLabel as SdkGroupLabel,
  MenuItem as SdkItem,
  MenuItemIndicator as SdkItemIndicator,
  MenuRadioItem as SdkRadioItem,
  MenuSeparator as SdkSeparator,
  MenuTrigger as SdkTrigger,
} from '@ui-sdk/react/menu';

export { Menu, MenuGroup, MenuRadioGroup, MenuTrigger } from '@ui-sdk/react/menu';

export function OverflowMenuTrigger({ compact = false, className = '', ...props }: Omit<ComponentProps<typeof SdkTrigger>, 'children'> & { compact?: boolean }) {
  return (
    <SdkTrigger
      className={`inline-flex ${compact ? 'size-8' : 'size-10'} shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors control-hover:bg-[var(--raised)] control-hover:text-[var(--text)] max-md:size-11 disabled:opacity-50 ${buttonFocusClassName} ${className}`}
      {...props}
    >
      <Ellipsis aria-hidden="true" size={16} strokeWidth={1.8} />
    </SdkTrigger>
  );
}

/**
 * Tempo styling for the UI SDK Menu: a raised overlay with hairline rules,
 * 40px rows (44px on touch), and the trace for the highlighted row.
 */
const itemClassName =
  'flex min-h-10 max-md:min-h-11 w-full select-none items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-[var(--text)] outline-none control-hover:bg-[var(--raised)] [&[data-highlighted]:not([aria-disabled=true],[data-disabled])]:bg-[var(--raised)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] data-[disabled]:opacity-50 data-[destructive]:text-[var(--status-danger)] [&_svg]:shrink-0 [&_svg]:text-[var(--text-muted)] data-[destructive]:[&_svg]:text-[var(--status-danger)]';

export function MenuContent({ className = '', ...props }: ComponentProps<typeof SdkContent>) {
  return (
    <SdkContent
      sideOffset={6}
      collisionPadding={12}
      className={`z-50 m-0 min-w-56 rounded-xl border border-[var(--border-strong)] ${overlayPanelClassName} p-1.5 ${className}`}
      {...props}
    />
  );
}

export function MenuItem({ className = '', ...props }: ComponentProps<typeof SdkItem>) {
  return <SdkItem className={`${itemClassName} ${className}`} {...props} />;
}

export function MenuCheckboxItem({ className = '', ...props }: ComponentProps<typeof SdkCheckboxItem>) {
  return <SdkCheckboxItem className={`${itemClassName} ${className}`} {...props} />;
}

export function MenuRadioItem({ className = '', ...props }: ComponentProps<typeof SdkRadioItem>) {
  return <SdkRadioItem className={`${itemClassName} ${className}`} {...props} />;
}

export function MenuGroupLabel({ className = '', ...props }: ComponentProps<typeof SdkGroupLabel>) {
  return <SdkGroupLabel className={`px-2.5 pb-1 pt-2 text-xs font-medium text-[var(--text-muted)] ${className}`} {...props} />;
}

export function MenuSeparator({ className = '', ...props }: ComponentProps<typeof SdkSeparator>) {
  return <SdkSeparator className={`my-1.5 h-px bg-[var(--border)] ${className}`} {...props} />;
}

/** Keeps its space while unchecked so labels stay aligned, but shows nothing. */
export function MenuItemIndicator({ className = '', ...props }: ComponentProps<typeof SdkItemIndicator>) {
  return <SdkItemIndicator keepMounted className={`inline-flex size-4 [&:not([data-checked])]:invisible ${className}`} {...props} />;
}
