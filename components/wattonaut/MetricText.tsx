import { ReactNode } from 'react';

export function MetricText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`metric-text ${className}`}>{children}</span>;
}
