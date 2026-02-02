import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type MultiSelectOption = { value: string; label: string };

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder: _placeholder = 'Select…',
  searchable = true,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower),
    );
  }, [options, search, searchable]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="border-b border-slate-100 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
      >
        {label}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          )}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
                />
                <span className="text-xs text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckboxGroupFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="border-b border-slate-100 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
      >
        {label}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
