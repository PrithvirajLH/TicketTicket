import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, type TicketRecord, type TeamRef } from '../api/client';
import type { Role, SortField, StatusFilter, TicketScope } from '../types';
import { formatDate, formatStatus, getSlaTone, statusBadgeClass } from '../utils/format';

export function TicketsPage({
  role,
  currentEmail,
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(presetStatus);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilterId, setTeamFilterId] = useState('');
  const [scopeFilter, setScopeFilter] = useState<TicketScope>(presetScope);

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  useEffect(() => {
    setStatusFilter(presetStatus);
  }, [presetStatus]);

  useEffect(() => {
    setScopeFilter(presetScope);
  }, [presetScope]);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, sortField, teamFilterId, scopeFilter, refreshKey]);

  async function loadTickets() {
    setLoadingTickets(true);
    setTicketError(null);
    setTickets([]);
    try {
      const effectiveSort =
        statusFilter === 'resolved' ? sortField : sortField === 'completedAt' ? 'createdAt' : sortField;
      const response = await fetchTickets({
        statusGroup: statusFilter,
        sort: effectiveSort,
        order: 'desc',
        teamId: teamFilterId || undefined,
        scope: scopeFilter === 'all' ? undefined : scopeFilter
      });
      setTickets(response.data);
    } catch (error) {
      setTicketError('Unable to load tickets.');
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }

  const scopedTickets = useMemo(() => {
    if (role === 'EMPLOYEE') {
      return tickets;
    }
    if (scopeFilter === 'created') {
      return tickets.filter((ticket) => ticket.requester?.email === currentEmail);
    }
    if (scopeFilter === 'assigned') {
      return tickets.filter((ticket) => ticket.assignee?.email === currentEmail);
    }
    if (scopeFilter === 'unassigned') {
      return tickets.filter((ticket) => !ticket.assignee);
    }
    return tickets;
  }, [tickets, role, scopeFilter, currentEmail]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) {
      return scopedTickets;
    }
    const lowered = searchQuery.toLowerCase();
    return scopedTickets.filter((ticket) => {
      return (
        ticket.subject.toLowerCase().includes(lowered) ||
        ticket.number.toString().includes(lowered) ||
        ticket.assignedTeam?.name?.toLowerCase().includes(lowered)
      );
    });
  }, [scopedTickets, searchQuery]);

  useEffect(() => {
    if (!teamFilterId) {
      return;
    }
    const exists = teamsList.some((team) => team.id === teamFilterId);
    if (!exists) {
      setTeamFilterId('');
    }
  }, [teamsList, teamFilterId]);

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {role === 'EMPLOYEE' ? 'Your tickets' : scopeFilter === 'created' ? 'Created by me' : 'Team tickets'}
            </h3>
            <p className="text-sm text-slate-500">Filter open, resolved, or all requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            {role !== 'EMPLOYEE' && (
              <select
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value as TicketScope)}
              >
                <option value="all">All visible</option>
                <option value="created">Created by me</option>
                <option value="assigned">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            )}
            <select
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={teamFilterId}
              onChange={(event) => setTeamFilterId(event.target.value)}
            >
              <option value="">All departments</option>
              {teamsList.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
            <select
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
            >
              <option value="createdAt">Sort by created</option>
              <option value="completedAt">Sort by completion</option>
            </select>
          </div>
        </div>

        {ticketError && <p className="text-sm text-red-600 mt-3">{ticketError}</p>}
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

        {!loadingTickets && (
          <div className="mt-4 space-y-3">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(ticket.status)}`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
