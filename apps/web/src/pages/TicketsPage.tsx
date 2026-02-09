import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  bulkAssignTickets,
  bulkPriorityTickets,
  bulkStatusTickets,
  bulkTransferTickets,
  fetchTickets,
  fetchUsers,
  type NotificationRecord,
  type TicketRecord,
  type TeamRef,
  type UserRef,
} from '../api/client';
import { BulkActionsToolbar } from '../components/BulkActionsToolbar';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterPanel } from '../components/filters/FilterPanel';
import { TicketTableView } from '../components/TicketTableView';
import { useFilters } from '../hooks/useFilters';
import { useFocusSearchOnShortcut } from '../hooks/useKeyboardShortcuts';
import { useTicketSelection } from '../hooks/useTicketSelection';
import { useToast } from '../hooks/useToast';
import type { Role, StatusFilter, TicketScope } from '../types';

type SortPreset = 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'completed_desc';

function sortPresetFromFilters(sort: string, order: string): SortPreset {
  if (sort === 'createdAt' && order === 'asc') return 'created_asc';
  if (sort === 'createdAt' && order === 'desc') return 'created_desc';
  if (sort === 'updatedAt' && order === 'asc') return 'updated_asc';
  if (sort === 'updatedAt' && order === 'desc') return 'updated_desc';
  return 'completed_desc';
}

function countActiveFilterGroups(filters: ReturnType<typeof useFilters>['filters']) {
  let count = 0;
  if (filters.statuses.length > 0) count += 1;
  if (filters.priorities.length > 0) count += 1;
  if (filters.teamIds.length > 0) count += 1;
  if (filters.assigneeIds.length > 0) count += 1;
  if (filters.requesterIds.length > 0) count += 1;
  if (filters.slaStatus.length > 0) count += 1;
  if (filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo || filters.dueFrom || filters.dueTo) count += 1;
  if (filters.q.trim()) count += 1;
  return count;
}

type TicketsHeaderProps = {
  title: string;
  subtitle: string;
  currentEmail: string;
  personas: { label: string; email: string }[];
  onEmailChange: (email: string) => void;
  onOpenSearch?: () => void;
  notificationProps?: {
    notifications: NotificationRecord[];
    unreadCount: number;
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onRefresh: () => void;
  };
};

export function TicketsPage({
  role,
  currentEmail: _currentEmail,
  presetStatus,
  presetScope,
  refreshKey,
  teamsList,
  onCreateTicket,
  headerProps,
}: {
  role: Role;
  currentEmail: string;
  presetStatus: StatusFilter;
  presetScope: TicketScope;
  refreshKey: number;
  teamsList: TeamRef[];
  onCreateTicket?: () => void;
  headerProps?: TicketsHeaderProps;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, setFilters, clearFilters, hasActiveFilters, apiParams } = useFilters(
    presetScope,
    presetStatus,
  );
  const toast = useToast();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [listMeta, setListMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<UserRef[]>([]);
  const [requesterOptions, setRequesterOptions] = useState<UserRef[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const ticketsRequestSeqRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useFocusSearchOnShortcut(searchInputRef);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft === filters.q) return;
      setFilters({ q: searchDraft }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters.q, searchDraft, setFilters]);

  const loadTickets = useCallback(async () => {
    const requestSeq = ++ticketsRequestSeqRef.current;
    setLoadingTickets(true);
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
      if (ticketsRequestSeqRef.current !== requestSeq) return;
      setTickets(response.data);
      setListMeta(response.meta ?? null);
    } catch {
      if (ticketsRequestSeqRef.current !== requestSeq) return;
      setTicketError('Unable to load tickets.');
      setListMeta(null);
    } finally {
      if (ticketsRequestSeqRef.current === requestSeq) {
        setLoadingTickets(false);
      }
    }
  }, [apiParams, filters.sort, filters.statusGroup]);

  const searchParamsString = searchParams.toString();
  useEffect(() => {
    loadTickets();
  }, [searchParamsString, refreshKey, loadTickets]);

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

  useEffect(() => {
    if (role !== 'OWNER' && filters.teamIds.length > 0) {
      setFilters({ teamIds: [] }, { replace: true });
    }
  }, [filters.teamIds.length, role, setFilters]);

  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets]);
  const selection = useTicketSelection(ticketIds);

  async function handleBulkAssign(assigneeId?: string) {
    return bulkAssignTickets(selection.selectedIds, assigneeId);
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

  const quickAssigneeValue = filters.assigneeIds.length === 1 ? filters.assigneeIds[0] : '';
  const quickPriorityValue = filters.priorities.length === 1 ? filters.priorities[0] : '';
  const sortPreset = sortPresetFromFilters(filters.sort, filters.order);
  const activeFilterCount = countActiveFilterGroups(filters);

  const totalCount = listMeta?.total ?? tickets.length;
  const countLabel =
    filters.statusGroup === 'open'
      ? `${totalCount} open tickets`
      : filters.statusGroup === 'resolved'
        ? `${totalCount} resolved tickets`
        : `${totalCount} tickets`;

  const pageStart = listMeta ? (listMeta.page - 1) * listMeta.pageSize + 1 : 0;
  const pageEnd = listMeta ? Math.min(listMeta.page * listMeta.pageSize, listMeta.total) : 0;

  return (
    <section className="min-w-0 animate-fade-in">
      <div className="mx-auto max-w-[1600px] min-w-0">
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <header className="border-b border-border px-6 py-5">
            {headerProps ? (
              <TopBar
                title={headerProps.title}
                subtitle={headerProps.subtitle}
                currentEmail={headerProps.currentEmail}
                personas={headerProps.personas}
                onEmailChange={headerProps.onEmailChange}
                onOpenSearch={headerProps.onOpenSearch}
                notificationProps={headerProps.notificationProps}
              />
            ) : (
              <>
                <h2 className="text-4xl font-semibold leading-tight text-foreground">All Tickets</h2>
                <p className="mt-1 text-lg text-muted-foreground">
                  Track, filter, and manage your support requests.
                </p>
              </>
            )}
          </header>

          <div className="border-b border-border bg-muted/[0.12] px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {role !== 'EMPLOYEE' ? (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    showAdvancedFilters
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted/30'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Advanced filter
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              ) : null}

              <select
                value={filters.statusGroup ?? 'all'}
                onChange={(event) => setFilters({ statusGroup: event.target.value as StatusFilter })}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="all">All statuses</option>
                <option value="open">Open tickets</option>
                <option value="resolved">Resolved tickets</option>
              </select>

              <select
                value={quickAssigneeValue}
                onChange={(event) => setFilters({ assigneeIds: event.target.value ? [event.target.value] : [] })}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">All assignees</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>

              <select
                value={quickPriorityValue}
                onChange={(event) => setFilters({ priorities: event.target.value ? [event.target.value] : [] })}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">All priorities</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>

              <select
                value={sortPreset}
                onChange={(event) => {
                  const preset = event.target.value as SortPreset;
                  if (preset === 'updated_desc') setFilters({ sort: 'updatedAt', order: 'desc' });
                  if (preset === 'updated_asc') setFilters({ sort: 'updatedAt', order: 'asc' });
                  if (preset === 'created_desc') setFilters({ sort: 'createdAt', order: 'desc' });
                  if (preset === 'created_asc') setFilters({ sort: 'createdAt', order: 'asc' });
                  if (preset === 'completed_desc') setFilters({ sort: 'completedAt', order: 'desc' });
                }}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="updated_desc">Sort by: Newest</option>
                <option value="updated_asc">Sort by: Oldest</option>
                <option value="created_desc">Sort by: Created (newest)</option>
                <option value="created_asc">Sort by: Created (oldest)</option>
                <option value="completed_desc">Sort by: Completed</option>
              </select>

              <div className="relative ml-auto min-w-[240px] flex-1 max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search tickets..."
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {onCreateTicket ? (
                <button
                  type="button"
                  onClick={onCreateTicket}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                </button>
              ) : null}
            </div>

            {showAdvancedFilters && role !== 'EMPLOYEE' ? (
              <div className="mt-3">
                <FilterPanel
                  filters={filters}
                  setFilters={setFilters}
                  clearFilters={clearFilters}
                  hasActiveFilters={hasActiveFilters}
                  showTeamFilter={role === 'OWNER'}
                  teamsList={teamsList}
                  assignableUsers={assignableUsers}
                  requesterOptions={requesterOptions}
                  onSaveSuccess={() => {
                    toast.success('View saved');
                    loadTickets();
                  }}
                  onError={(message) => toast.error(message)}
                  onClose={() => setShowAdvancedFilters(false)}
                />
              </div>
            ) : null}
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{countLabel}</p>
            </div>

            {selection.isSomeSelected && role !== 'EMPLOYEE' ? (
              <div className="mt-3">
                <BulkActionsToolbar
                  selectedCount={selection.selectedCount}
                  onClearSelection={selection.clearSelection}
                  onBulkAssign={handleBulkAssign}
                  onBulkTransfer={handleBulkTransfer}
                  onBulkStatus={handleBulkStatus}
                  onBulkPriority={handleBulkPriority}
                  teamsList={teamsList}
                  assignableUsers={assignableUsers}
                  onSuccess={(message) => {
                    toast.success(message);
                    loadTickets();
                  }}
                  onError={(message) => toast.error(message)}
                />
              </div>
            ) : null}

            {ticketError ? (
              <div className="mt-3">
                <ErrorState
                  title="Unable to load tickets"
                  description={ticketError}
                  onRetry={loadTickets}
                  secondaryAction={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard') }}
                />
              </div>
            ) : null}

            {loadingTickets ? (
              <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={`ticket-row-skeleton-${index}`}
                    className="h-14 rounded-lg border border-border/60 bg-muted/25 skeleton-shimmer"
                  />
                ))}
              </div>
            ) : null}

            {!loadingTickets && !ticketError && tickets.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No tickets found"
                  description="Try adjusting your filters or create a new ticket to get started."
                  primaryAction={onCreateTicket ? { label: 'Create Ticket', onClick: onCreateTicket } : undefined}
                  secondaryAction={hasActiveFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
                />
              </div>
            ) : null}

            {!loadingTickets && tickets.length > 0 ? (
              <div className="mt-3">
                <TicketTableView
                  tickets={tickets}
                  role={role}
                  selection={{
                    isSelected: selection.isSelected,
                    toggle: selection.toggle,
                    toggleAll: selection.toggleAll,
                    isAllSelected: selection.isAllSelected,
                  }}
                  onRowClick={(ticket) => navigate(`/tickets/${ticket.id}`)}
                />
              </div>
            ) : null}
          </div>

          {!loadingTickets && listMeta && listMeta.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart}-{pageEnd} of {listMeta.total}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                  Rows per page
                  <select
                    value={filters.pageSize}
                    onChange={(event) => setFilters({ pageSize: Number(event.target.value), page: 1 })}
                    className="bg-transparent text-foreground focus:outline-none"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={listMeta.page <= 1}
                  onClick={() => setFilters({ page: listMeta.page - 1 })}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
                  {listMeta.page}
                </span>
                <button
                  type="button"
                  disabled={listMeta.page >= listMeta.totalPages}
                  onClick={() => setFilters({ page: listMeta.page + 1 })}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
