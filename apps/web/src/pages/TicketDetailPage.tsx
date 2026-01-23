import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addTicketMessage, fetchTicketById, type TicketDetail } from '../api/client';
import { formatDate, formatStatus, formatTicketId, initialsFor, statusBadgeClass } from '../utils/format';

export function TicketDetailPage({
  refreshKey,
  currentEmail
}: {
  refreshKey: number;
  currentEmail: string;
}) {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const statusEvents = ticket ? ticket.events.filter((event) => event.type === 'TICKET_STATUS_CHANGED') : [];

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    loadTicketDetail(ticketId);
  }, [ticketId, refreshKey]);

  useEffect(() => {
    if (!ticket) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.id, ticket?.messages?.length]);

  async function loadTicketDetail(id: string) {
    setLoadingDetail(true);
    setTicketError(null);
    try {
      const detail = await fetchTicketById(id);
      setTicket(detail);
    } catch (error) {
      setTicketError('Unable to load ticket details.');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleReply() {
    if (!ticketId || !messageBody.trim()) {
      return;
    }
    setTicketError(null);
    try {
      await addTicketMessage(ticketId, { body: messageBody, type: 'PUBLIC' });
      setMessageBody('');
      await loadTicketDetail(ticketId);
    } catch (error) {
      setTicketError('Unable to send reply.');
    }
  }

  return (
    <section className="mt-8 animate-fade-in">
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-6">
          {loadingDetail && (
            <div className="glass-card p-5 animate-pulse">
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-3 h-6 w-96 rounded-full bg-slate-200" />
              <div className="mt-3 h-3 w-48 rounded-full bg-slate-100" />
            </div>
          )}
          {!loadingDetail && ticket && (
            <div className="glass-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Ticket overview</p>
                  <h2 className="text-2xl font-semibold text-slate-900 mt-1">{ticket.subject}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1">
                      Ticket ID {formatTicketId(ticket)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1">
                      Internal ID {ticket.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold ${statusBadgeClass(ticket.status)}`}
                >
                  {formatStatus(ticket.status)}
                </span>
              </div>
            </div>
          )}

          <div className="glass-card p-6 flex flex-col min-h-[640px]">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Conversation</h3>
              <p className="text-sm text-slate-500">Chat with the assigned agent.</p>
            </div>
            {ticketError && <p className="text-sm text-red-600 mt-3">{ticketError}</p>}
            {loadingDetail && (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`message-skeleton-${index}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 animate-pulse"
                  >
                    <div className="h-3 w-32 rounded-full bg-slate-200" />
                    <div className="mt-3 h-3 w-48 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            )}
            {!loadingDetail && !ticket && <p className="text-sm text-slate-500 mt-3">Ticket not found.</p>}
            {ticket && (
              <>
                <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-4">
                  {ticket.messages.length === 0 && (
                    <div className="text-sm text-slate-500">No messages yet. Start the conversation.</div>
                  )}
                  {ticket.messages.map((message) => {
                    const isOwn = message.author.email === currentEmail;
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-semibold shadow-soft">
                          {initialsFor(message.author.displayName)}
                        </div>
                        <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 text-sm shadow-soft ${
                              isOwn
                                ? 'bg-slate-900 text-white'
                                : 'bg-white/80 border border-slate-200/70 text-slate-700'
                            }`}
                          >
                            {!isOwn && (
                              <p className="text-xs font-semibold text-slate-500 mb-1">
                                {message.author.displayName}
                              </p>
                            )}
                            <p>{message.body}</p>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{formatDate(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="mt-4 border-t border-slate-200/60 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <textarea
                      className="flex-1 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      rows={2}
                      placeholder="Reply to the agent..."
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleReply}
                      className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 transition"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <TicketDetailsCard ticket={ticket} loading={loadingDetail} />

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-slate-900">Status history</h3>
            <p className="text-sm text-slate-500">Timeline of status changes.</p>
            {ticket && (
              <div className="mt-4 max-h-[400px] overflow-y-auto pr-2">
                {statusEvents.length === 0 && (
                  <p className="text-sm text-slate-500">No status changes recorded yet.</p>
                )}
                <div className="relative space-y-3">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                  {statusEvents.map((event) => {
                    const payload = event.payload as { from?: string; to?: string } | null;
                    const fromStatus = payload?.from ? formatStatus(payload.from) : '—';
                    const toStatus = payload?.to ? formatStatus(payload.to) : formatStatus(ticket.status);
                    const actorLabel = event.createdBy?.displayName ?? event.createdBy?.email ?? 'System';
                    return (
                      <div key={event.id} className="relative pl-6">
                        <span
                          className={`absolute left-[2px] top-2 h-2.5 w-2.5 rounded-full border ${
                            statusBadgeClass(payload?.to)
                          }`}
                        />
                        <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap">{formatDate(event.createdAt)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400 truncate">by {actorLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-start sm:justify-center">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusBadgeClass(payload?.from)}`}
                            >
                              {fromStatus}
                            </span>
                            <span className="text-slate-300">→</span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusBadgeClass(payload?.to)}`}
                            >
                              {toStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function priorityColor(priority: string) {
  switch (priority) {
    case 'P1':
      return 'from-red-500 to-rose-600 text-white';
    case 'P2':
      return 'from-amber-500 to-orange-500 text-white';
    case 'P3':
      return 'from-sky-500 to-blue-500 text-white';
    case 'P4':
      return 'from-slate-400 to-slate-500 text-white';
    default:
      return 'from-slate-400 to-slate-500 text-white';
  }
}

function TicketDetailsCard({ ticket, loading }: { ticket: TicketDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass-card overflow-hidden animate-pulse">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-700" />
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-slate-700" />
              <div className="mt-2 h-3 w-32 rounded bg-slate-700/50" />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-3 w-full rounded bg-slate-200" />
          <div className="h-3 w-3/4 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-white/10">
            {initialsFor(ticket.requester?.displayName ?? 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {ticket.requester?.displayName ?? 'Unknown'}
            </p>
            <p className="text-xs text-slate-400 truncate">{ticket.requester?.email ?? '—'}</p>
          </div>
          <div
            className={`h-8 w-8 rounded-lg bg-gradient-to-br ${priorityColor(ticket.priority)} flex items-center justify-center text-xs font-bold shadow-lg`}
          >
            {ticket.priority}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Created {formatDate(ticket.createdAt)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Department</span>
          <span className="text-sm font-medium text-slate-900">
            {ticket.assignedTeam?.name ?? <span className="text-slate-400 italic">Unassigned</span>}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Assignee</span>
          {ticket.assignee ? (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[10px] font-semibold">
                {initialsFor(ticket.assignee.displayName)}
              </div>
              <span className="text-sm font-medium text-slate-900">{ticket.assignee.displayName}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400 italic">Unassigned</span>
          )}
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Channel</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {ticket.channel ?? '—'}
          </span>
        </div>

        {ticket.category && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Category</span>
            <span className="text-sm font-medium text-slate-900">{ticket.category.name}</span>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Reference</span>
          <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded">
            {formatTicketId(ticket)}
          </span>
        </div>
      </div>
    </div>
  );
}
