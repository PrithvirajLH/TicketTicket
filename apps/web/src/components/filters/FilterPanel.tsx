import { useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { CheckboxGroupFilter, MultiSelectFilter, type MultiSelectOption } from './MultiSelectFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { SavedViewsDropdown } from './SavedViewsDropdown';
import type { TicketFilters } from '../../types';
import type { TeamRef } from '../../api/client';
import type { UserRef } from '../../api/client';

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'NEW', label: 'New' },
  { value: 'TRIAGED', label: 'Triaged' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_ON_REQUESTER', label: 'Waiting on Requester' },
  { value: 'WAITING_ON_VENDOR', label: 'Waiting on Vendor' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REOPENED', label: 'Reopened' },
];

const PRIORITY_OPTIONS: MultiSelectOption[] = [
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'P3', label: 'P3' },
  { value: 'P4', label: 'P4' },
];

const SLA_STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'breached', label: 'Breached' },
];

export function FilterPanel({
  filters,
  setFilters,
  clearFilters,
  hasActiveFilters,
  teamsList,
  assignableUsers,
  requesterOptions,
  onSaveSuccess,
  onError,
}: {
  filters: TicketFilters;
  setFilters: (updates: Partial<TicketFilters>) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  teamsList: TeamRef[];
  assignableUsers: UserRef[];
  requesterOptions: UserRef[];
  onSaveSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const teamOptions: MultiSelectOption[] = teamsList.map((t) => ({ value: t.id, label: t.name }));
  const assigneeOptions: MultiSelectOption[] = assignableUsers.map((u) => ({
    value: u.id,
    label: u.displayName,
  }));
  const requesterSelectOptions: MultiSelectOption[] = requesterOptions.map((u) => ({
    value: u.id,
    label: u.displayName,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Filters</span>
          {hasActiveFilters && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
              Active
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="mt-3 space-y-0">
            <CheckboxGroupFilter
              label="Status"
              options={STATUS_OPTIONS}
              selected={filters.statuses}
              onChange={(statuses) => setFilters({ statuses })}
            />
            <CheckboxGroupFilter
              label="Priority"
              options={PRIORITY_OPTIONS}
              selected={filters.priorities}
              onChange={(priorities) => setFilters({ priorities })}
            />
            <MultiSelectFilter
              label="Team"
              options={teamOptions}
              selected={filters.teamIds}
              onChange={(teamIds) => setFilters({ teamIds })}
            />
            <MultiSelectFilter
              label="Assignee"
              options={assigneeOptions}
              selected={filters.assigneeIds}
              onChange={(assigneeIds) => setFilters({ assigneeIds })}
            />
            <MultiSelectFilter
              label="Requester"
              options={requesterSelectOptions}
              selected={filters.requesterIds}
              onChange={(requesterIds) => setFilters({ requesterIds })}
            />
            <CheckboxGroupFilter
              label="SLA Status"
              options={SLA_STATUS_OPTIONS}
              selected={filters.slaStatus}
              onChange={(slaStatus) => setFilters({ slaStatus: slaStatus as typeof filters.slaStatus })}
            />
            <DateRangeFilter
              label="Created Date"
              from={filters.createdFrom}
              to={filters.createdTo}
              onFromChange={(createdFrom) => setFilters({ createdFrom })}
              onToChange={(createdTo) => setFilters({ createdTo })}
            />
            <DateRangeFilter
              label="Updated Date"
              from={filters.updatedFrom}
              to={filters.updatedTo}
              onFromChange={(updatedFrom) => setFilters({ updatedFrom })}
              onToChange={(updatedTo) => setFilters({ updatedTo })}
            />
            <DateRangeFilter
              label="Due Date"
              from={filters.dueFrom}
              to={filters.dueTo}
              onFromChange={(dueFrom) => setFilters({ dueFrom })}
              onToChange={(dueTo) => setFilters({ dueTo })}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[140px]">
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters({ q: e.target.value })}
                placeholder="Subject or description…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <SavedViewsDropdown
              currentFilters={filters}
              onApplyFilters={setFilters}
              onSaveSuccess={onSaveSuccess}
              onError={onError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
