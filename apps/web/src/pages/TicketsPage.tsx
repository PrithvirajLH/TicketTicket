import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
import { FilterPanel } from '../components/filters/FilterPanel';
import { RelativeTime } from '../components/RelativeTime';
import { TicketTableView } from '../components/TicketTableView';
import { ViewToggle } from '../components/ViewToggle';
import { useFilters } from '../hooks/useFilters';
import { useFocusSearchOnShortcut } from '../hooks/useKeyboardShortcuts';
import { useTableSettings } from '../hooks/useTableSettings';
import { useTicketSelection } from '../hooks/useTicketSelection';
import type { Role, StatusFilter, TicketScope } from '../types';
import { formatStatus, getSlaTone, statusBadgeClass } from '../utils/format';

export function TicketsPage({
  role,
  currentEmail: _currentEmail,
  presetStatus,
  presetScope,
  refreshKey,
  teamsList
}: {
  role: Role;
  currentEmail: string;
  presetStatus: StatusFilter;
  presetScope: TicketScope;
  refreshKey: number;
  teamsList: TeamRef[];
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  return (
    <section className="mt-8 min-w-0 space-y-6 animate-fade-in">
      {toast && (
        <div className="fixed right-8 top-6 z-50">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="glass-card min-w-0 p-6">
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
              setToast({ message: msg, type: 'success' });
              loadTickets();
            }}
            onError={(msg) => setToast({ message: msg, type: 'error' })}
          />
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {role === 'EMPLOYEE' ? 'Your tickets' : filters.scope === 'created' ? 'Created by me' : 'Team tickets'}
              </h3>
              <p className="text-sm text-slate-500">
                Filter and search tickets.
                {refreshingTickets ? <span className="ml-2 text-xs text-slate-400">Refreshing…</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Search subject or description"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
              </div>
              <select
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={filters.sort}
                onChange={(event) => setFilters({ sort: event.target.value as typeof filters.sort })}
              >
                <option value="createdAt">Sort by created</option>
                <option value="updatedAt">Sort by updated</option>
                <option value="completedAt">Sort by completion</option>
              </select>
              <select
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={filters.statusGroup ?? 'open'}
                onChange={(event) => setFilters({ statusGroup: event.target.value as StatusFilter })}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
              <ViewToggle
                value={tableSettings.viewMode}
                onChange={tableSettings.setViewMode}
              />
            </div>
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
                setToast({ message: 'View saved', type: 'success' });
                loadTickets();
              }}
              onError={(msg) => setToast({ message: msg, type: 'error' })}
            />
          )}
        </div>

        {ticketError && <p className="text-sm text-red-600 mt-3">{ticketError}</p>}

        {hasActiveFilters && role !== 'EMPLOYEE' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filters.statuses.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Status: {filters.statuses.map(formatStatus).join(', ')}
                <button
                  type="button"
                  onClick={() => setFilters({ statuses: [] })}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200"
                  aria-label="Clear status"
                >
                  ×
                </button>
              </span>
            )}
            {filters.priorities.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Priority: {filters.priorities.join(', ')}
                <button type="button" onClick={() => setFilters({ priorities: [] })} className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200" aria-label="Clear priority">×</button>
              </span>
            )}
            {filters.teamIds.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Team: {filters.teamIds.length} selected
                <button type="button" onClick={() => setFilters({ teamIds: [] })} className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200" aria-label="Clear team">×</button>
              </span>
            )}
            {filters.slaStatus.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                SLA: {filters.slaStatus.join(', ')}
                <button type="button" onClick={() => setFilters({ slaStatus: [] })} className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200" aria-label="Clear SLA">×</button>
              </span>
            )}
            {(filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo || filters.dueFrom || filters.dueTo) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Date range
                <button
                  type="button"
                  onClick={() => setFilters({ createdFrom: '', createdTo: '', updatedFrom: '', updatedTo: '', dueFrom: '', dueTo: '' })}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200"
                  aria-label="Clear dates"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {loadingTickets && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`ticket-skeleton-${index}`}
                className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 animate-pulse"
              >
                <div className="h-3 w-40 rounded-full bg-slate-200" />
                <div className="mt-2 h-3 w-24 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        )}
        {!loadingTickets && filteredTickets.length === 0 && (
          <p className="text-sm text-slate-500 mt-4">No tickets match this filter.</p>
        )}

        {!loadingTickets && filteredTickets.length > 0 && role !== 'EMPLOYEE' && tableSettings.viewMode === 'grid' && (
          <div className="mt-4 flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selection.isAllSelected}
                onChange={selection.toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
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
          <div className="mt-4 space-y-3">
            {filteredTickets.map((ticket, index) => (
              <div
                key={ticket.id}
                ref={(el) => {
                  ticketRowRefs.current[index] = el;
                }}
                tabIndex={0}
                role="button"
                className={`flex items-center gap-3 w-full rounded-2xl border px-4 py-3 transition hover:shadow-soft group outline-none ${
                  index === focusedTicketIndex
                    ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2 bg-white shadow-md'
                    : 'border-slate-200 bg-white/80'
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
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
                    />
                  </label>
                )}
                <div
                  className="flex-1 flex items-center justify-between text-left min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{ticket.subject}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                    <RelativeTime value={ticket.createdAt} className="text-xs text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingTickets && listMeta && listMeta.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Showing {(listMeta.page - 1) * listMeta.pageSize + 1}–{Math.min(listMeta.page * listMeta.pageSize, listMeta.total)} of {listMeta.total} tickets
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={listMeta.page <= 1}
                onClick={() => setFilters({ page: listMeta.page - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {listMeta.page} of {listMeta.totalPages}
              </span>
              <button
                type="button"
                disabled={listMeta.page >= listMeta.totalPages}
                onClick={() => setFilters({ page: listMeta.page + 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
