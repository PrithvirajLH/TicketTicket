import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function DateRangeFilter({
  label,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/60 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
      >
        {label}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">From</span>
            <input
              type="date"
              value={from || ''}
              onChange={(e) => onFromChange(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">To</span>
            <input
              type="date"
              value={to || ''}
              onChange={(e) => onToChange(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
      )}
    </div>
  );
}
