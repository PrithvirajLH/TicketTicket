import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  bulkAssignTickets,
  bulkPriorityTickets,
  bulkStatusTickets,
  bulkTransferTickets,
  fetchTickets,
  fetchUsers,
  type TicketRecord,
  type TeamRef,
  type UserRef
} from '../api/client';
import { BulkActionsToolbar } from '../components/BulkActionsToolbar';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterPanel } from '../components/filters/FilterPanel';
import { RelativeTime } from '../components/RelativeTime';
import { TicketTableView } from '../components/TicketTableView';
import { ViewToggle } from '../components/ViewToggle';
import { TicketCardSkeleton, TicketTableSkeleton } from '../components/skeletons';
import { useFilters } from '../hooks/useFilters';
import { useFocusSearchOnShortcut } from '../hooks/useKeyboardShortcuts';
import { useTableSettings } from '../hooks/useTableSettings';
import { useTicketSelection } from '../hooks/useTicketSelection';
import { useToast } from '../hooks/useToast';
import type { Role, StatusFilter, TicketScope } from '../types';
import { formatStatus, getSlaTone, statusBadgeClass } from '../utils/format';

export function TicketsPage({
  role,
  currentEmail: _currentEmail,
  presetStatus,
  presetScope,
  refreshKey,
  teamsList,
  onCreateTicket,
}: {
  role: Role;
  currentEmail: string;
  presetStatus: StatusFilter;
  presetScope: TicketScope;
  refreshKey: number;
  teamsList: TeamRef[];
  onCreateTicket?: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, setFilters, clearFilters, hasActiveFilters, apiParams } = useFilters(
    presetScope,
    presetStatus
  );
  const tableSettings = useTableSettings();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const ticketsRequestSeqRef = useRef(0);
  const [listMeta, setListMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null);
  // loadingTickets: initial load (no prior data) -> show skeleton instead of content.
  // refreshingTickets: subsequent loads -> keep previous data visible and show a subtle indicator.
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [refreshingTickets, setRefreshingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<UserRef[]>([]);
  const [requesterOptions, setRequesterOptions] = useState<UserRef[]>([]);
  const toast = useToast();
  const [focusedTicketIndex, setFocusedTicketIndex] = useState(0);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ticketRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusedIndexRef = useRef(0);
  const [searchDraft, setSearchDraft] = useState(filters.q);

  useFocusSearchOnShortcut(searchInputRef);

  useEffect(() => {
    focusedIndexRef.current = focusedTicketIndex;
  }, [focusedTicketIndex]);

  // Keep input text in sync if filters.q changes externally (e.g. back/forward navigation).
  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  // Debounce search to avoid firing a network request on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchDraft;
      if (next === filters.q) return;
      setFilters({ q: next }, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchDraft, filters.q, setFilters]);

  const loadTickets = useCallback(async () => {
    const requestSeq = ++ticketsRequestSeqRef.current;
    const hasPreviousData = tickets.length > 0;
    if (hasPreviousData) {
      setRefreshingTickets(true);
    } else {
      setLoadingTickets(true);
    }
    setTicketError(null);
    try {
      const effectiveSort =
        filters.statusGroup === 'resolved'
          ? filters.sort
          : filters.sort === 'completedAt'
            ? 'createdAt'
            : filters.sort;
      const response = await fetchTickets({
        ...apiParams,
        sort: effectiveSort,
      });
      if (ticketsRequestSeqRef.current !== requestSeq) {
        return;
      }
      setTickets(response.data);
      setListMeta(response.meta ?? null);
    } catch (error) {
      if (ticketsRequestSeqRef.current !== requestSeq) {
        return;
      }
      setTicketError('Unable to load tickets.');
      // Keep previous tickets visible to reduce flicker; only clear meta (pagination) since it may be stale.
      setListMeta(null);
    } finally {
      if (ticketsRequestSeqRef.current === requestSeq) {
        setLoadingTickets(false);
        setRefreshingTickets(false);
      }
    }
  }, [apiParams, filters.statusGroup, filters.sort, tickets.length]);

  // Refetch when URL search params or refreshKey change (URL is source of truth for filters)
  const searchParamsString = searchParams.toString();
  useEffect(() => {
    loadTickets();
  }, [searchParamsString, refreshKey, loadTickets]);

  const filteredTickets = tickets;
  const ticketIds = useMemo(() => filteredTickets.map((t) => t.id), [filteredTickets]);
  const selection = useTicketSelection(ticketIds);

  // Fetch users: assignable (for bulk assign / Assignee filter) and all users (for Requester filter)
  useEffect(() => {
    if (role === 'EMPLOYEE') {
      setAssignableUsers([]);
      setRequesterOptions([]);
      return;
    }
    fetchUsers()
      .then((res) => {
        setAssignableUsers(res.data);
        setRequesterOptions(res.data);
      })
      .catch(() => {
        setAssignableUsers([]);
        setRequesterOptions([]);
      });
  }, [role]);

  async function handleBulkAssign(assigneeId?: string) {
    const result = await bulkAssignTickets(selection.selectedIds, assigneeId);
    return result;
  }

  async function handleBulkTransfer(newTeamId: string, assigneeId?: string) {
    return bulkTransferTickets(selection.selectedIds, newTeamId, assigneeId);
  }

  async function handleBulkStatus(status: string) {
    return bulkStatusTickets(selection.selectedIds, status);
  }

  async function handleBulkPriority(priority: string) {
    return bulkPriorityTickets(selection.selectedIds, priority);
  }

  // Clamp focused index when list changes
  useEffect(() => {
    const n = filteredTickets.length;
    if (n === 0) {
      setFocusedTicketIndex(0);
      return;
    }
    setFocusedTicketIndex((prev) => (prev >= n ? n - 1 : prev));
  }, [filteredTickets.length]);

  // Ticket list keyboard shortcuts: J, K, Enter, X, Shift+X (grid view only)
  useEffect(() => {
    if (tableSettings.viewMode !== 'grid') return;
    if (filteredTickets.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      // Don't trigger list shortcuts when modifier keys are held (e.g. Cmd+K = palette, not K = previous)
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const n = filteredTickets.length;
      if (n === 0) return;

      switch (event.key) {
        case 'j':
        case 'J':
          if (!event.shiftKey) {
            event.preventDefault();
            setFocusedTicketIndex((prev) => (prev + 1 >= n ? prev : prev + 1));
          }
          break;
        case 'k':
        case 'K':
          if (!event.shiftKey) {
            event.preventDefault();
            setFocusedTicketIndex((prev) => (prev <= 0 ? 0 : prev - 1));
          }
          break;
        case 'Enter':
          event.preventDefault();
          const currentIdx = focusedIndexRef.current;
          const ticket = filteredTickets[currentIdx];
          if (ticket) navigate(`/tickets/${ticket.id}`);
          break;
        case 'x':
        case 'X':
          if (event.shiftKey) {
            event.preventDefault();
            const currentIdx = focusedIndexRef.current;
            const from = Math.min(anchorIndex, currentIdx);
            const to = Math.max(anchorIndex, currentIdx);
            for (let i = from; i <= to; i++) {
              const t = filteredTickets[i];
              if (t && !selection.isSelected(t.id)) selection.toggle(t.id);
            }
          } else {
            event.preventDefault();
            const currentIdx = focusedIndexRef.current;
            const focused = filteredTickets[currentIdx];
            if (focused) {
              selection.toggle(focused.id);
              setAnchorIndex(currentIdx);
            }
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTickets, anchorIndex, selection, navigate, tableSettings.viewMode]);

  // Scroll focused ticket into view
  useEffect(() => {
    const el = ticketRowRefs.current[focusedTicketIndex];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedTicketIndex]);

  const title =
    role === 'EMPLOYEE'
      ? 'Your tickets'
      : filters.scope === 'created'
        ? 'Created by me'
        : 'Team tickets';

  const totalCount = listMeta?.total ?? filteredTickets.length;
  const totalCountLabel = `${totalCount} ticket${totalCount === 1 ? '' : 's'}`;

  return (
    <section className="mt-8 min-w-0 animate-fade-in">
      <div className="mx-auto max-w-[1600px] min-w-0">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-8 shadow-card">
        {selection.isSomeSelected && role !== 'EMPLOYEE' && (
          <BulkActionsToolbar
            selectedCount={selection.selectedCount}
            onClearSelection={selection.clearSelection}
            onBulkAssign={handleBulkAssign}
            onBulkTransfer={handleBulkTransfer}
            onBulkStatus={handleBulkStatus}
            onBulkPriority={handleBulkPriority}
            teamsList={teamsList}
            assignableUsers={assignableUsers}
            onSuccess={(msg) => {
              toast.success(msg);
              loadTickets();
            }}
            onError={(msg) => toast.error(msg)}
          />
        )}

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter and search tickets.
              {refreshingTickets ? (
                <span className="ml-2 text-xs text-muted-foreground">Refreshing…</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-10 pr-4 h-11 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Search subject or description…"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </div>

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <select
                className="h-11 rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={filters.sort}
                onChange={(event) => setFilters({ sort: event.target.value as typeof filters.sort })}
              >
                <option value="createdAt">Sort by created</option>
                <option value="updatedAt">Sort by updated</option>
                <option value="completedAt">Sort by completion</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <select
                className="h-11 rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={filters.statusGroup ?? 'open'}
                onChange={(event) => setFilters({ statusGroup: event.target.value as StatusFilter })}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
            </div>

            <ViewToggle value={tableSettings.viewMode} onChange={tableSettings.setViewMode} />

            {onCreateTicket && (
              <button
                type="button"
                onClick={onCreateTicket}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-opacity"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Create ticket
              </button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">{totalCountLabel}</span>
          </div>

          {role !== 'EMPLOYEE' && (
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              teamsList={teamsList}
              assignableUsers={assignableUsers}
              requesterOptions={requesterOptions}
              onSaveSuccess={() => {
                toast.success('View saved');
                loadTickets();
              }}
              onError={(msg) => toast.error(msg)}
            />
          )}

        {ticketError && (
          <div>
            <ErrorState
              title="Unable to load tickets"
              description={ticketError}
              onRetry={loadTickets}
              secondaryAction={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard') }}
            />
          </div>
        )}

        {hasActiveFilters && role !== 'EMPLOYEE' && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.statuses.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                Status: {filters.statuses.map(formatStatus).join(', ')}
                <button
                  type="button"
                  onClick={() => setFilters({ statuses: [] })}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/40"
                  aria-label="Clear status"
                >
                  ×
                </button>
              </span>
            )}
            {filters.priorities.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                Priority: {filters.priorities.join(', ')}
                <button
                  type="button"
                  onClick={() => setFilters({ priorities: [] })}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/40"
                  aria-label="Clear priority"
                >
                  ×
                </button>
              </span>
            )}
            {filters.teamIds.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                Team: {filters.teamIds.length} selected
                <button
                  type="button"
                  onClick={() => setFilters({ teamIds: [] })}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/40"
                  aria-label="Clear team"
                >
                  ×
                </button>
              </span>
            )}
            {filters.slaStatus.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                SLA: {filters.slaStatus.join(', ')}
                <button
                  type="button"
                  onClick={() => setFilters({ slaStatus: [] })}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/40"
                  aria-label="Clear SLA"
                >
                  ×
                </button>
              </span>
            )}
            {(filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo || filters.dueFrom || filters.dueTo) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                Date range
                <button
                  type="button"
                  onClick={() => setFilters({ createdFrom: '', createdTo: '', updatedFrom: '', updatedTo: '', dueFrom: '', dueTo: '' })}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/40"
                  aria-label="Clear dates"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {loadingTickets && tableSettings.viewMode === 'grid' && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <TicketCardSkeleton
                key={`ticket-skeleton-${index}`}
                showCheckbox={role !== 'EMPLOYEE'}
              />
            ))}
          </div>
        )}
        {loadingTickets && tableSettings.viewMode === 'table' && (
          <TicketTableSkeleton
            columnWidths={tableSettings.columnWidths}
            columnVisibility={tableSettings.columnVisibility}
            showCheckbox={role !== 'EMPLOYEE'}
            rowCount={8}
          />
        )}
        {!loadingTickets && !ticketError && filteredTickets.length === 0 && (
          <EmptyState
            title="No tickets found"
            description="Try adjusting your filters or create a new ticket to get started."
            primaryAction={
              onCreateTicket ? { label: 'Create Ticket', onClick: onCreateTicket } : undefined
            }
            secondaryAction={
              hasActiveFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined
            }
          />
        )}

        {!loadingTickets && filteredTickets.length > 0 && role !== 'EMPLOYEE' && tableSettings.viewMode === 'grid' && (
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={selection.isAllSelected}
                onChange={selection.toggleAll}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring/30"
              />
              Select all
            </label>
          </div>
        )}

        {!loadingTickets && tableSettings.viewMode === 'table' && filteredTickets.length > 0 && (
          <TicketTableView
            tickets={filteredTickets}
            role={role}
            selection={{
              isSelected: selection.isSelected,
              toggle: selection.toggle,
              toggleAll: selection.toggleAll,
              isAllSelected: selection.isAllSelected,
            }}
            columnWidths={tableSettings.columnWidths}
            columnVisibility={tableSettings.columnVisibility}
            setColumnWidth={tableSettings.setColumnWidth}
            setColumnVisible={tableSettings.setColumnVisible}
            sortField={filters.sort}
            sortOrder={filters.order}
            onSortChange={(field, order) => setFilters({ sort: field, order })}
            onRowClick={(ticket) => navigate(`/tickets/${ticket.id}`)}
          />
        )}

        {!loadingTickets && tableSettings.viewMode === 'grid' && filteredTickets.length > 0 && (
          <div className="space-y-3">
            {filteredTickets.map((ticket, index) => (
              <div
                key={ticket.id}
                ref={(el) => {
                  ticketRowRefs.current[index] = el;
                }}
                tabIndex={0}
                role="button"
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 transition hover:shadow-soft outline-none ${
                  index === focusedTicketIndex
                    ? 'border-primary ring-2 ring-ring/30 ring-offset-2 bg-card shadow-elevated'
                    : 'border-border bg-card'
                }`}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                onKeyDown={(e) => {
                  // Ignore when focus is on checkbox/button inside row (e.g. Space toggles checkbox, not navigate)
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/tickets/${ticket.id}`);
                  }
                }}
              >
                {role !== 'EMPLOYEE' && (
                  <label
                    className="flex-shrink-0 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selection.isSelected(ticket.id)}
                      onChange={() => selection.toggle(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring/30"
                    />
                  </label>
                )}
                <div
                  className="flex-1 flex items-center justify-between text-left min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{ticket.assignedTeam?.name ?? 'Unassigned'}</span>
                      {(() => {
                        const sla = getSlaTone({
                          dueAt: ticket.dueAt,
                          completedAt: ticket.completedAt,
                          status: ticket.status,
                          slaPausedAt: ticket.slaPausedAt
                        });
                        return (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sla.className}`}
                          >
                            {sla.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(ticket.status)}`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                    <RelativeTime value={ticket.createdAt} className="text-xs text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingTickets && listMeta && listMeta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(listMeta.page - 1) * listMeta.pageSize + 1}–{Math.min(listMeta.page * listMeta.pageSize, listMeta.total)} of {listMeta.total} tickets
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={listMeta.page <= 1}
                onClick={() => setFilters({ page: listMeta.page - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {listMeta.page} of {listMeta.totalPages}
              </span>
              <button
                type="button"
                disabled={listMeta.page >= listMeta.totalPages}
                onClick={() => setFilters({ page: listMeta.page + 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
    </section>
  );
}
