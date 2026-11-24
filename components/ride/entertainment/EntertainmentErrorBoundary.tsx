'use client';

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

import { compactSecondaryButtonClassName } from '@/components/ui';

type Props = { children: ReactNode; onTurnOff: () => void };
type State = { failed: boolean; attempt: number };

/**
 * Keeps a failure inside an entertainment view (a chunk that didn't load, a render error) in the
 * stage: the ride screen and its recording carry on, and the rider can try again or turn it off.
 */
export class EntertainmentErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Entertainment view failed', error, info.componentStack);
  }

  private retry = () => {
    // A new key remounts the view, which loads its code again.
    this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }));
  };

  render() {
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return (
      <div role="alert" className="grid h-full place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-sm text-[var(--text)]">Entertainment hit a problem. Your ride is still recording.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={compactSecondaryButtonClassName} onClick={this.retry}>Try again</button>
            <button type="button" className={compactSecondaryButtonClassName} onClick={this.props.onTurnOff}>Turn off</button>
          </div>
        </div>
      </div>
    );
  }
}
