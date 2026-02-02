import { useEffect, useState } from 'react';
import { formatDateLong, formatRelative } from '../utils/format';

type RelativeTimeProps = {
  value: string | Date | null | undefined;
  className?: string;
};

/**
 * Displays a timestamp as relative time ("2 hours ago") with absolute date/time on hover.
 * Updates every minute while mounted.
 */
export function RelativeTime({ value, className }: RelativeTimeProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (value == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [value]);

  if (value == null) {
    return <span className={className}>—</span>;
  }

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return <span className={className}>—</span>;
  }

  const title = formatDateLong(date);
  const text = formatRelative(value);

  return (
    <time dateTime={date.toISOString()} title={title} className={className}>
      {text}
    </time>
  );
}
