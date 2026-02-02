import { LayoutGrid, Table2 } from 'lucide-react';
import type { ViewMode } from '../hooks/useTableSettings';

export function ViewToggle({
  value,
  onChange,
  className = '',
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 ${className}`}
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
          value === 'grid'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-pressed={value === 'grid'}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        Grid
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
          value === 'table'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-pressed={value === 'table'}
      >
        <Table2 className="h-4 w-4" aria-hidden />
        Table
      </button>
    </div>
  );
}
