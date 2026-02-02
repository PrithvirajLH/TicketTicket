import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  assignTicket,
  fetchTickets,
  transitionTicket,
  type TeamRef,
  type TicketRecord
} from '../api/client';
import { RelativeTime } from '../components/RelativeTime';
import { formatStatus, formatTicketId, getSlaTone, statusBadgeClass } from '../utils/format';

const TRIAGE_COLUMNS = [
  { key: 'NEW', label: 'New' },
  { key: 'TRIAGED', label: 'Triaged' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'WAITING_ON_REQUESTER', label: 'Waiting on Requester' },
  { key: 'WAITING_ON_VENDOR', label: 'Waiting on Vendor' },
  { key: 'REOPENED', label: 'Reopened' }
];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED'],
  TRIAGED: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED'],
  WAITING_ON_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  WAITING_ON_VENDOR: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['REOPENED', 'CLOSED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED']
};

export function TriageBoardPage({
  refreshKey,
  teamsList,
  currentEmail
}: {
  refreshKey: number;
  teamsList: TeamRef[];
  currentEmail: string;
}) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [draggingStatus, setDraggingStatus] = useState<string | null>(null);
  const [dragTargetStatus, setDragTargetStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilterId, setTeamFilterId] = useState('');

  useEffect(() => {
    loadTickets();
  }, [refreshKey, teamFilterId]);

  useEffect(() => {
    if (!teamFilterId) {
      return;
    }
    const exists = teamsList.some((team) => team.id === teamFilterId);
    if (!exists) {
      setTeamFilterId('');
    }
  }, [teamsList, teamFilterId]);

  async function loadTickets() {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const response = await fetchTickets({
        statusGroup: 'open',
        sort: 'updatedAt',
        order: 'desc',
        pageSize: 100,
        teamId: teamFilterId || undefined
      });
      setTickets(response.data);
    } catch (err) {
      setError('Unable to load triage tickets.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignSelf(ticket: TicketRecord) {
    setActionTicketId(ticket.id);
    setActionError(null);
    try {
      const updated = await assignTicket(ticket.id, {});
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? { ...item, ...updated } : item)));
      setToast({ message: 'Ticket assigned to you.', type: 'success' });
    } catch (err) {
      setActionError('Unable to assign ticket.');
      setToast({ message: 'Unable to assign ticket.', type: 'error' });
    } finally {
      setActionTicketId(null);
    }
  }

  async function handleTransition(ticketId: string, status: string) {
    setActionTicketId(ticketId);
    setActionError(null);
    try {
      const updated = await transitionTicket(ticketId, { status });
      setTickets((prev) => prev.map((item) => (item.id === ticketId ? { ...item, ...updated } : item)));
      setToast({ message: `Moved to ${formatStatus(status)}.`, type: 'success' });
    } catch (err) {
      setActionError('Unable to move ticket to that status.');
      setToast({ message: 'Unable to move ticket to that status.', type: 'error' });
    } finally {
      setActionTicketId(null);
    }
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, ticket: TicketRecord) {
    setDraggingTicketId(ticket.id);
    setDraggingStatus(ticket.status);
    event.dataTransfer.setData('text/plain', JSON.stringify({ id: ticket.id, status: ticket.status }));
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingTicketId(null);
    setDraggingStatus(null);
    setDragTargetStatus(null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, status: string) {
    if (!draggingStatus) {
      return;
    }
    if (!isValidTransition(draggingStatus, status)) {
      return;
    }
    event.preventDefault();
    setDragTargetStatus(status);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: string) {
    setDragTargetStatus(null);
    if (!draggingStatus) {
      return;
    }
    if (!isValidTransition(draggingStatus, status)) {
      setToast({
        message: `Cannot move from ${formatStatus(draggingStatus)} to ${formatStatus(status)}.`,
        type: 'error'
      });
      return;
    }
    event.preventDefault();
    const payload = event.dataTransfer.getData('text/plain');
    if (!payload) {
      return;
    }
    try {
      const { id } = JSON.parse(payload) as { id: string; status?: string };
      const ticket = tickets.find((item) => item.id === id);
      if (!ticket || ticket.status === status) {
        if (ticket?.status === status) {
          setToast({ message: 'Ticket already in that status.', type: 'info' });
        }
        return;
      }
      handleTransition(ticket.id, status);
    } catch {
      return;
    }
  }

  function isValidTransition(from: string, to: string) {
    if (from === to) {
      return true;
    }
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) {
      return tickets;
    }
    const lowered = searchQuery.toLowerCase();
    return tickets.filter((ticket) => {
      return (
        ticket.subject.toLowerCase().includes(lowered) ||
        ticket.requester?.displayName?.toLowerCase().includes(lowered) ||
        ticket.assignedTeam?.name?.toLowerCase().includes(lowered) ||
        String(ticket.number).includes(lowered)
      );
    });
  }, [tickets, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, TicketRecord[]>();
    TRIAGE_COLUMNS.forEach((col) => map.set(col.key, []));
    filteredTickets.forEach((ticket) => {
      if (!map.has(ticket.status)) {
        map.set(ticket.status, []);
      }
      map.get(ticket.status)?.push(ticket);
    });
    return map;
  }, [filteredTickets]);

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      {toast && (
        <div className="fixed right-8 top-6 z-50">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : toast.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Triage board</h3>
            <p className="text-sm text-slate-500">Monitor open tickets by status and team.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Search tickets"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
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
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {actionError && <p className="text-sm text-red-600 mt-3">{actionError}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Drag a ticket card between columns to update its status.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-6 animate-pulse">
          <div className="h-4 w-40 rounded-full bg-slate-200" />
          <div className="mt-4 h-3 w-56 rounded-full bg-slate-100" />
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto pb-2">
          <div className="grid auto-cols-[270px] grid-flow-col gap-4">
            {TRIAGE_COLUMNS.map((column) => {
              const columnTickets = grouped.get(column.key) ?? [];
              return (
                <div
                  key={column.key}
                  className={`rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-soft transition ${
                    dragTargetStatus === column.key ? 'ring-2 ring-slate-300/70' : ''
                  }`}
                  onDragOver={(event) => handleDragOver(event, column.key)}
                  onDrop={(event) => handleDrop(event, column.key)}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(column.key)}`}
                    >
                      {formatStatus(column.key)}
                    </span>
                    <span className="text-xs text-slate-500">{columnTickets.length}</span>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {columnTickets.length === 0 && (
                      <p className="text-xs text-slate-400">No tickets here.</p>
                    )}
                    {columnTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        draggable
                        onDragStart={(event) => handleDragStart(event, ticket)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className={`group w-full rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft ${
                          draggingTicketId === ticket.id ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {ticket.subject}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-500">{ticket.priority}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {ticket.assignedTeam?.name ?? 'Unassigned'} ·{' '}
                          {ticket.assignee?.displayName ?? 'Unassigned'}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {formatTicketId(ticket)} · <RelativeTime value={ticket.updatedAt} />
                        </p>
                        <div className="mt-2">
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
                        <div className="mt-3 flex flex-wrap items-center gap-2 opacity-0 transition group-hover:opacity-100">
                          {!ticket.assignee && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAssignSelf(ticket);
                              }}
                              disabled={actionTicketId === ticket.id}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Assign to me
                            </button>
                          )}
                          {ticket.assignee?.email === currentEmail && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                              Yours
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
