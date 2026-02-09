import { X } from 'lucide-react';
import { MultiSelectFilter, type MultiSelectOption } from './MultiSelectFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { SavedViewsDropdown } from './SavedViewsDropdown';
import { TextFilterDropdown } from './TextFilterDropdown';
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
  showTeamFilter = true,
  teamsList,
  assignableUsers,
  requesterOptions,
  onSaveSuccess,
  onError,
  onClose,
}: {
  filters: TicketFilters;
  setFilters: (updates: Partial<TicketFilters>) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  showTeamFilter?: boolean;
  teamsList: TeamRef[];
  assignableUsers: UserRef[];
  requesterOptions: UserRef[];
  onSaveSuccess?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}) {
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Advanced filters</h4>
          <p className="text-xs text-muted-foreground">Refine by status, ownership, SLA, and dates.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.statuses}
          onChange={(statuses) => setFilters({ statuses })}
          placeholder="All statuses"
          searchable
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={filters.priorities}
          onChange={(priorities) => setFilters({ priorities })}
          placeholder="All priorities"
          searchable={false}
        />
        <MultiSelectFilter
          label="SLA Status"
          options={SLA_STATUS_OPTIONS}
          selected={filters.slaStatus}
          onChange={(slaStatus) => setFilters({ slaStatus: slaStatus as typeof filters.slaStatus })}
          placeholder="Any SLA status"
          searchable={false}
        />
        {showTeamFilter ? (
          <MultiSelectFilter
            label="Team"
            options={teamOptions}
            selected={filters.teamIds}
            onChange={(teamIds) => setFilters({ teamIds })}
            placeholder="All teams"
          />
        ) : null}
        <MultiSelectFilter
          label="Assignee"
          options={assigneeOptions}
          selected={filters.assigneeIds}
          onChange={(assigneeIds) => setFilters({ assigneeIds })}
          placeholder="All assignees"
        />
        <MultiSelectFilter
          label="Requester"
          options={requesterSelectOptions}
          selected={filters.requesterIds}
          onChange={(requesterIds) => setFilters({ requesterIds })}
          placeholder="All requesters"
        />
        <DateRangeFilter
          label="Created Date"
          from={filters.createdFrom}
          to={filters.createdTo}
          onFromChange={(createdFrom) => setFilters({ createdFrom })}
          onToChange={(createdTo) => setFilters({ createdTo })}
          placeholder="Any created date"
        />
        <DateRangeFilter
          label="Updated Date"
          from={filters.updatedFrom}
          to={filters.updatedTo}
          onFromChange={(updatedFrom) => setFilters({ updatedFrom })}
          onToChange={(updatedTo) => setFilters({ updatedTo })}
          placeholder="Any updated date"
        />
        <DateRangeFilter
          label="Due Date"
          from={filters.dueFrom}
          to={filters.dueTo}
          onFromChange={(dueFrom) => setFilters({ dueFrom })}
          onToChange={(dueTo) => setFilters({ dueTo })}
          placeholder="Any due date"
        />
        <TextFilterDropdown
          label="Contains"
          value={filters.q}
          onChange={(q) => setFilters({ q })}
          placeholder="Any text"
          inputPlaceholder="Subject or description..."
        />
        <div className="min-w-[180px] self-end">
          <SavedViewsDropdown
            currentFilters={filters}
            onApplyFilters={setFilters}
            onSaveSuccess={onSaveSuccess}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
