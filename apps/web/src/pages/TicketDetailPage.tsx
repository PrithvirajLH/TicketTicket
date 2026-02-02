import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Copy, Info, ListOrdered, MessageSquare } from 'lucide-react';
import {
  addTicketMessage,
  ApiError,
  assignTicket,
  downloadAttachment,
  followTicket,
  fetchTeamMembers,
  fetchTicketById,
  uploadTicketAttachment,
  transitionTicket,
  transferTicket,
  unfollowTicket,
  type TeamMember,
  type TeamRef,
  type TicketDetail,
  type TicketMessage
} from '../api/client';
import type { Role } from '../types';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { MessageBody } from '../components/MessageBody';
import { RelativeTime } from '../components/RelativeTime';
import { RichTextEditor, type RichTextEditorRef } from '../components/RichTextEditor';
import { SlaCountdownTimer } from '../components/SlaCountdownTimer';
import { copyToClipboard } from '../utils/clipboard';
import { htmlMentionsToMarkdown } from '../utils/messageBody';
import { formatStatus, formatTicketId, initialsFor, statusBadgeClass } from '../utils/format';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  TRIAGED: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  WAITING_ON_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_VENDOR: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['REOPENED', 'CLOSED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED']
};

export function TicketDetailPage({
  refreshKey,
  currentEmail,
  role,
  teamsList
}: {
  refreshKey: number;
  currentEmail: string;
  role: Role;
  teamsList: TeamRef[];
}) {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [messageType, setMessageType] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [assignToId, setAssignToId] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [transferTeamId, setTransferTeamId] = useState('');
  const [transferAssigneeId, setTransferAssigneeId] = useState('');
  const [transferMembers, setTransferMembers] = useState<TeamMember[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showAllAttachments, setShowAllAttachments] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyToast, setCopyToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [conversationView, setConversationView] = useState<'conversation' | 'timeline'>('conversation');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyEditorRef = useRef<RichTextEditorRef | null>(null);
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);
  const navigate = useNavigate();
  const statusEvents = ticket ? ticket.events.filter((event) => event.type === 'TICKET_STATUS_CHANGED') : [];
  const followers = ticket?.followers ?? [];
  const isFollowing = followers.some((follower) => follower.user.email === currentEmail);
  const canManage = role !== 'EMPLOYEE';
  const canUpload = ticket ? role !== 'EMPLOYEE' || ticket.requester?.email === currentEmail : false;
  const memberRoleLookup = useMemo(
    () => new Map(teamMembers.map((member) => [member.user.id, member.role])),
    [teamMembers]
  );
  const availableTransitions = useMemo(() => {
    if (!ticket) {
      return [];
    }
    return STATUS_TRANSITIONS[ticket.status] ?? [];
  }, [ticket]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    loadTicketDetail(ticketId);
  }, [ticketId, refreshKey]);

  useEffect(() => {
    if (!ticket?.assignedTeam?.id) {
      setTeamMembers([]);
      return;
    }
    setMembersLoading(true);
    fetchTeamMembers(ticket.assignedTeam.id)
      .then((response) => setTeamMembers(response.data))
      .catch(() => setTeamMembers([]))
      .finally(() => setMembersLoading(false));
  }, [ticket?.assignedTeam?.id]);

  useEffect(() => {
    if (!transferTeamId) {
      setTransferMembers([]);
      setTransferAssigneeId('');
      return;
    }
    setTransferAssigneeId('');
    fetchTeamMembers(transferTeamId)
      .then((response) => setTransferMembers(response.data))
      .catch(() => setTransferMembers([]));
  }, [transferTeamId]);

  useEffect(() => {
    if (!ticket) {
      return;
    }
    const next = availableTransitions[0] ?? '';
    setNextStatus(next);
    setAssignToId('');
    setTransferTeamId('');
    setTransferAssigneeId('');
  }, [ticket?.id, ticket?.status, availableTransitions]);

  useEffect(() => {
    if (!ticket) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.id, ticket?.messages?.length]);

  useEffect(() => {
    if (role === 'EMPLOYEE') {
      setMessageType('PUBLIC');
    }
  }, [role]);

  useEffect(() => {
    if (!copyToast) return;
    const t = window.setTimeout(() => {
      setCopyToast(null);
      setLinkCopied(false);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [copyToast]);

  async function handleCopyLink() {
    if (!ticketId) return;
    const url = `${window.location.origin}/tickets/${ticketId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setLinkCopied(true);
      setCopyToast({ message: 'Link copied to clipboard', type: 'success' });
    } else {
      setLinkCopied(false);
      setCopyToast({ message: 'Could not copy link', type: 'error' });
    }
  }

  // Ticket detail keyboard shortcuts: R (focus reply), A (assign to me), S (status), Escape (go back)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't run if a modal (palette, shortcuts help, etc.) already handled the event
      if (event.defaultPrevented) return;

      // Don't run when a modal is open (Esc should close modal, not navigate)
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      // Shortcuts don't fire when typing (including Escape in reply textarea)
      if (isInput) return;

      switch (event.key) {
        case 'r':
        case 'R':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            replyEditorRef.current?.focus();
          }
          break;
        case 'a':
        case 'A':
          if (!event.ctrlKey && !event.metaKey && !event.altKey && canManage && !ticket?.assignee) {
            event.preventDefault();
            handleAssignSelf();
          }
          break;
        case 's':
        case 'S':
          if (!event.ctrlKey && !event.metaKey && !event.altKey && canManage) {
            event.preventDefault();
            statusSelectRef.current?.focus();
          }
          break;
        case 'Escape':
          event.preventDefault();
          navigate(-1);
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canManage, ticket?.assignee, navigate]);

  async function loadTicketDetail(id: string) {
    setLoadingDetail(true);
    setTicketError(null);
    setAccessDenied(false);
    setTicket(null);
    try {
      const detail = await fetchTicketById(id);
      setTicket(detail);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setAccessDenied(true);
        setTicketError('You don’t have access to this ticket.');
      } else {
        setTicketError('Unable to load ticket details.');
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleReply() {
    const bodyToSend = htmlMentionsToMarkdown(messageBody);
    if (!ticketId || !bodyToSend.trim() || !ticket) {
      return;
    }
    setTicketError(null);
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMessage: TicketMessage = {
      id: optimisticId,
      body: bodyToSend,
      type: messageType,
      createdAt: new Date().toISOString(),
      author: { id: 'pending', email: currentEmail, displayName: currentEmail.split('@')[0] || 'You' }
    };
    setTicket((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticMessage] } : prev
    );
    setMessageBody('');
    addTicketMessage(ticketId, { body: bodyToSend, type: messageType })
      .then((serverMessage) => {
        setTicket((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === optimisticId ? serverMessage : m
                )
              }
            : prev
        );
        loadTicketDetail(ticketId);
      })
      .catch(() => {
        setTicket((prev) =>
          prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticId) } : prev
        );
        setTicketError('Unable to send reply.');
      });
  }

  async function handleAssignSelf() {
    if (!ticket) {
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      const updated = await assignTicket(ticket.id, {});
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadTicketDetail(ticket.id);
    } catch (error) {
      setActionError('Unable to assign ticket.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignMember() {
    if (!ticket || !assignToId) {
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      const updated = await assignTicket(ticket.id, { assigneeId: assignToId });
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadTicketDetail(ticket.id);
    } catch (error) {
      setActionError('Unable to assign ticket.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransition() {
    if (!ticket || !nextStatus || nextStatus === ticket.status) {
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      const updated = await transitionTicket(ticket.id, { status: nextStatus });
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadTicketDetail(ticket.id);
    } catch (error) {
      setActionError('Unable to change status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransfer() {
    if (!ticket || !transferTeamId) {
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      const updated = await transferTicket(ticket.id, {
        newTeamId: transferTeamId,
        assigneeId: transferAssigneeId || undefined
      });
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadTicketDetail(ticket.id);
    } catch (error) {
      setActionError('Unable to transfer ticket.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFollowToggle() {
    if (!ticket) {
      return;
    }
    setFollowError(null);
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowTicket(ticket.id);
      } else {
        await followTicket(ticket.id);
      }
      await loadTicketDetail(ticket.id);
    } catch (error) {
      setFollowError('Unable to update followers.');
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!ticketId) {
      return;
    }
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setAttachmentError(null);
    setAttachmentUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadTicketAttachment(ticketId, file);
      }
      await loadTicketDetail(ticketId);
    } catch (error) {
      setAttachmentError('Unable to upload attachment.');
    } finally {
      setAttachmentUploading(false);
      event.target.value = '';
    }
  }

  async function handleAttachmentDownload(attachmentId: string, fileName: string) {
    setAttachmentError(null);
    try {
      const blob = await downloadAttachment(attachmentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setAttachmentError('Unable to download attachment.');
    }
  }

  async function handleAttachmentView(attachmentId: string) {
    setAttachmentError(null);
    try {
      const blob = await downloadAttachment(attachmentId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setAttachmentError('Unable to open attachment.');
    }
  }

  function internalRoleLabel(teamRole?: string) {
    switch (teamRole) {
      case 'LEAD':
        return 'Lead';
      case 'AGENT':
        return 'Agent';
      case 'ADMIN':
        return 'Admin';
      default:
        return null;
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  function internalBadgeClasses(teamRole?: string) {
    switch (teamRole) {
      case 'LEAD':
        return 'border-indigo-200 bg-indigo-100 text-indigo-700';
      case 'ADMIN':
        return 'border-slate-200 bg-slate-100 text-slate-700';
      default:
        return 'border-amber-200 bg-amber-100 text-amber-700';
    }
  }

  function internalBubbleClasses(teamRole?: string) {
    switch (teamRole) {
      case 'LEAD':
        return 'bg-indigo-50 border border-indigo-200/70 text-indigo-900';
      case 'ADMIN':
        return 'bg-slate-50 border border-slate-200/70 text-slate-900';
      default:
        return 'bg-amber-50 border border-amber-200/70 text-amber-900';
    }
  }

  return (
    <section className="mt-8 animate-fade-in">
      {copyToast && (
        <div className="fixed right-8 top-6 z-50">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              copyToast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {copyToast.message}
          </div>
        </div>
      )}
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
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Ticket ID
                    </span>
                    <span className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                      <span className="font-mono tracking-tight">{formatTicketId(ticket)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition shrink-0"
                      aria-label="Copy link"
                    >
                      {linkCopied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-500" />
                      )}
                      <span>Copy link</span>
                    </button>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  View
                </span>
                <div
                  role="tablist"
                  aria-label="Conversation or activity timeline"
                  className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' && conversationView === 'timeline') {
                      e.preventDefault();
                      setConversationView('conversation');
                    }
                    if (e.key === 'ArrowRight' && conversationView === 'conversation') {
                      e.preventDefault();
                      setConversationView('timeline');
                    }
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={conversationView === 'conversation'}
                    aria-controls="ticket-conversation-panel"
                    id="tab-conversation"
                    tabIndex={conversationView === 'conversation' ? 0 : -1}
                    onClick={() => setConversationView('conversation')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 ${
                      conversationView === 'conversation'
                        ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden />
                    Conversation
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={conversationView === 'timeline'}
                    aria-controls="ticket-timeline-panel"
                    id="tab-timeline"
                    tabIndex={conversationView === 'timeline' ? 0 : -1}
                    onClick={() => setConversationView('timeline')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 ${
                      conversationView === 'timeline'
                        ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <ListOrdered className="h-4 w-4 flex-shrink-0" aria-hidden />
                    Timeline
                  </button>
                </div>
              </div>
              {conversationView === 'conversation' && (
                <p className="text-sm text-slate-500">
                  {role === 'EMPLOYEE' ? 'Chat with the assigned agent.' : 'Chat with the requester.'}
                </p>
              )}
            </div>
            {ticketError && !accessDenied && <p className="text-sm text-red-600 mt-3">{ticketError}</p>}
            {accessDenied && (
              <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
                <p className="text-sm font-medium">You don’t have access to this ticket.</p>
                <p className="text-sm text-amber-800 mt-1">Switch to a user who can view it, or go back to the ticket list.</p>
                <button
                  type="button"
                  onClick={() => navigate('/tickets')}
                  className="mt-3 text-sm font-semibold text-amber-800 hover:text-amber-900 underline"
                >
                  Back to tickets
                </button>
              </div>
            )}
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
            {!loadingDetail && !ticket && !accessDenied && <p className="text-sm text-slate-500 mt-3">Ticket not found.</p>}
            {ticket && (
              <div className="flex flex-col flex-1 min-h-0 mt-4">
                {conversationView === 'timeline' ? (
                  <div
                    id="ticket-timeline-panel"
                    role="tabpanel"
                    aria-labelledby="tab-timeline"
                    className="flex-1 min-h-0 overflow-y-auto pr-2"
                  >
                    <ActivityTimeline ticket={ticket} />
                  </div>
                ) : (
                  <div
                    id="ticket-conversation-panel"
                    role="tabpanel"
                    aria-labelledby="tab-conversation"
                    className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4"
                  >
                    {ticket.messages.length === 0 && (
                      <div className="text-sm text-slate-500">No messages yet. Start the conversation.</div>
                    )}
                    {ticket.messages.map((message) => {
                    const isOptimistic =
                      typeof message.id === 'string' && message.id.startsWith('opt-');
                    const isOwn = message.author?.email === currentEmail;
                    const isInternal = message.type === 'INTERNAL';
                    const authorTeamRole = isOptimistic
                      ? role
                      : memberRoleLookup.get(message.author.id) ??
                        (message.author?.email === currentEmail ? role : undefined);
                    const internalLabel = internalRoleLabel(authorTeamRole);
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-semibold shadow-soft">
                          {initialsFor(message.author?.displayName ?? currentEmail)}
                        </div>
                        <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 text-sm shadow-soft ${
                              isOwn
                                ? isInternal
                                  ? internalBubbleClasses(authorTeamRole)
                                  : 'bg-slate-900 text-white'
                                : isInternal
                                ? internalBubbleClasses(authorTeamRole)
                                : 'bg-white/80 border border-slate-200/70 text-slate-700'
                            }`}
                          >
                            {!isOwn && (
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-semibold text-slate-500">
                                  {message.author?.displayName ?? message.author?.email ?? '—'}
                                </p>
                                {isInternal && (
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${internalBadgeClasses(authorTeamRole)}`}
                                  >
                                    Internal{internalLabel ? ` • ${internalLabel}` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                            <MessageBody body={message.body} invert={isOwn && !isInternal} />
                          </div>
                          <span className="text-xs text-slate-400 mt-1 block">
                            <RelativeTime value={message.createdAt} />
                            {isOwn && isOptimistic && <span className="ml-2 opacity-70">Sending…</span>}
                          </span>
                          {isOwn && isInternal && (
                            <span
                              className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${internalBadgeClasses(authorTeamRole)}`}
                            >
                              Internal{internalLabel ? ` • ${internalLabel}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                )}
                {conversationView === 'conversation' && (
                  <div className="flex-shrink-0 border-t border-slate-200/60 pt-4 mt-4">
                    {role !== 'EMPLOYEE' && (
                      <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white/80 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setMessageType('PUBLIC')}
                          className={`rounded-full px-3 py-1 font-semibold transition ${
                            messageType === 'PUBLIC'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Public reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageType('INTERNAL')}
                          className={`rounded-full px-3 py-1 font-semibold transition ${
                            messageType === 'INTERNAL'
                              ? 'bg-amber-500 text-white'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Internal note
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 bg-white/80 focus-within:ring-2 focus-within:ring-slate-900/10">
                        <RichTextEditor
                          ref={replyEditorRef}
                          value={messageBody}
                          onChange={setMessageBody}
                          placeholder={messageType === 'INTERNAL' ? 'Add an internal note…' : 'Reply to the requester…'}
                          users={teamMembers.map((m) => m.user)}
                          cannedVariables={{
                            ticketId: ticket?.id,
                            ticketSubject: ticket?.subject,
                            requesterName: ticket?.requester?.displayName ?? ticket?.requester?.email,
                          }}
                          minRows={2}
                          maxRows={12}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleReply}
                        className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 transition"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {ticket && (
            <div className="glass-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Attachments</h3>
                  <p className="text-sm text-slate-500">
                    {ticket.attachments.length === 0
                      ? 'No files uploaded yet.'
                      : `${ticket.attachments.length} file${ticket.attachments.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                {canUpload && (
                  <label className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white cursor-pointer">
                    {attachmentUploading ? 'Uploading…' : 'Add files'}
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={handleAttachmentUpload}
                      disabled={attachmentUploading}
                    />
                  </label>
                )}
              </div>
              {attachmentError && <p className="mt-3 text-sm text-red-600">{attachmentError}</p>}
              <div className="mt-4 space-y-3">
                {ticket.attachments.length === 0 && (
                  <p className="text-sm text-slate-500">Attach screenshots or documents to help resolve faster.</p>
                )}
                {(showAllAttachments ? ticket.attachments : ticket.attachments.slice(0, 3)).map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{attachment.fileName}</p>
                      <p className="text-xs text-slate-600">
                        {formatFileSize(attachment.sizeBytes)} · Uploaded by {attachment.uploadedBy.displayName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAttachmentView(attachment.id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAttachmentDownload(attachment.id, attachment.fileName)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
                {ticket.attachments.length > 3 && !showAllAttachments && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      ... and {ticket.attachments.length - 3} more file{ticket.attachments.length - 3 === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllAttachments(true)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
                    >
                      View all
                    </button>
                  </div>
                )}
                {ticket.attachments.length > 3 && showAllAttachments && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllAttachments(false)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
                    >
                      Show less
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {ticket && (
            <div className="space-y-3">
              <SlaCountdownTimer type="first_response" ticket={ticket} />
              <SlaCountdownTimer type="resolution" ticket={ticket} />
            </div>
          )}
          {canManage && (
            <div className="glass-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Agent actions</h3>
                  <p className="text-sm text-slate-500">Assign, transition, or transfer this ticket.</p>
                </div>
                {ticket && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                      Team: {ticket.assignedTeam?.name ?? 'Unassigned'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                      Assignee: {ticket.assignee?.displayName ?? 'Unassigned'}
                    </span>
                  </div>
                )}
              </div>
              {actionError && <p className="text-sm text-red-600 mt-3">{actionError}</p>}
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Assign</p>
                      <p className="text-xs text-slate-500">Self or team member</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                      {ticket?.assignee ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    {!ticket?.assignee && (
                      <button
                        type="button"
                        onClick={handleAssignSelf}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Assign to me
                      </button>
                    )}
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={assignToId}
                      onChange={(event) => setAssignToId(event.target.value)}
                      disabled={membersLoading || actionLoading || teamMembers.length === 0}
                    >
                      <option value="">{membersLoading ? 'Loading team…' : 'Select member'}</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.user.id}>
                          {member.user.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignMember}
                      disabled={!assignToId || actionLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Status</p>
                      <p className="text-xs text-slate-500">Workflow change</p>
                    </div>
                    {ticket && (
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${statusBadgeClass(ticket.status)}`}
                      >
                        {formatStatus(ticket.status)}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <select
                      ref={statusSelectRef}
                      className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value)}
                      disabled={actionLoading || availableTransitions.length === 0}
                    >
                      {availableTransitions.length === 0 && <option value="">No transitions</option>}
                      {availableTransitions.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTransition}
                      disabled={actionLoading || !nextStatus || nextStatus === ticket?.status}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Update status
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Transfer</p>
                      <p className="text-xs text-slate-500">Move to another team</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                      Reassign ownership
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={transferTeamId}
                      onChange={(event) => setTransferTeamId(event.target.value)}
                      disabled={actionLoading}
                    >
                      <option value="">Select department</option>
                      {teamsList.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={transferAssigneeId}
                      onChange={(event) => setTransferAssigneeId(event.target.value)}
                      disabled={actionLoading || !transferTeamId}
                    >
                      <option value="">No assignee</option>
                      {transferMembers.map((member) => (
                        <option key={member.id} value={member.user.id}>
                          {member.user.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTransfer}
                      disabled={
                        actionLoading ||
                        !transferTeamId ||
                        transferTeamId === ticket?.assignedTeam?.id
                      }
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Transfer
                    </button>
                  </div>
                  {transferTeamId && transferTeamId === ticket?.assignedTeam?.id && (
                    <p className="mt-2 text-xs text-amber-600">
                      Choose a different department to transfer this ticket.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Info className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">Ticket Details</p>
                  <p className="text-xs text-slate-500">
                    {ticket ? `${ticket.priority} · ${ticket.assignedTeam?.name ?? 'Unassigned'}` : 'Loading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ticket && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(ticket.status)}`}>
                    {formatStatus(ticket.status)}
                  </span>
                )}
                {detailsExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </button>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                detailsExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <TicketDetailsCard ticket={ticket} loading={loadingDetail} />
            </div>
          </div>

          {ticket && (
            <div className="glass-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Followers</h3>
                  <p className="text-sm text-slate-500">
                    {followers.length === 0 ? 'No followers yet.' : `${followers.length} watching`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
                    isFollowing
                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
              {followError && <p className="mt-3 text-sm text-red-600">{followError}</p>}
              {followers.length > 0 && (
                <div className="mt-4 space-y-2">
                  {followers.map((follower) => (
                    <div key={follower.id} className="flex items-center gap-3 text-sm text-slate-700">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-[11px] font-semibold">
                        {initialsFor(follower.user.displayName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{follower.user.displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{follower.user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                            <RelativeTime value={event.createdAt} className="whitespace-nowrap" />
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
      <div className="animate-pulse">
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
    <div>
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
            Created <RelativeTime value={ticket.createdAt} />
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

        {renderSlaRow('First response SLA', getFirstResponseSla(ticket))}
        {renderSlaRow('Resolution SLA', getResolutionSla(ticket))}

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

const SLA_RISK_WINDOW_MS = 4 * 60 * 60 * 1000;
const SLA_FIRST_RESPONSE_RISK_MS = 2 * 60 * 60 * 1000;

function renderSlaRow(label: string, sla: { label: string; tone: string; detail: ReactNode }) {
  return (
    <div className="py-2 border-b border-slate-100">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sla.tone}`}>
          {sla.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{sla.detail}</p>
    </div>
  );
}

function getFirstResponseSla(ticket: TicketDetail) {
  if (ticket.firstResponseAt) {
    return {
      label: 'Responded',
      tone: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      detail: (
        <>
          Responded <RelativeTime value={ticket.firstResponseAt} />
        </>
      )
    };
  }

  if (!ticket.firstResponseDueAt) {
    return {
      label: 'Not set',
      tone: 'border-slate-200 bg-slate-100 text-slate-600',
      detail: 'No SLA configured'
    };
  }

  const dueMs = new Date(ticket.firstResponseDueAt).getTime() - Date.now();
  if (dueMs < 0) {
    return {
      label: 'Breached',
      tone: 'border-rose-200 bg-rose-100 text-rose-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.firstResponseDueAt} />
        </>
      )
    };
  }
  if (dueMs <= SLA_FIRST_RESPONSE_RISK_MS) {
    return {
      label: 'At risk',
      tone: 'border-amber-200 bg-amber-100 text-amber-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.firstResponseDueAt} />
        </>
      )
    };
  }
  return {
    label: 'Open',
    tone: 'border-sky-200 bg-sky-100 text-sky-700',
    detail: (
      <>
        Due <RelativeTime value={ticket.firstResponseDueAt} />
      </>
    )
  };
}

function getResolutionSla(ticket: TicketDetail) {
  if (ticket.completedAt) {
    return {
      label: 'Met',
      tone: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      detail: (
        <>
          Completed <RelativeTime value={ticket.completedAt} />
        </>
      )
    };
  }

  if (!ticket.dueAt) {
    return {
      label: 'Not set',
      tone: 'border-slate-200 bg-slate-100 text-slate-600',
      detail: 'No SLA configured'
    };
  }

  const isPaused =
    ticket.status === 'WAITING_ON_REQUESTER' || ticket.status === 'WAITING_ON_VENDOR';

  if (isPaused) {
    return {
      label: 'Paused',
      tone: 'border-amber-200 bg-amber-100 text-amber-700',
      detail: ticket.slaPausedAt ? (
        <>
          Paused <RelativeTime value={ticket.slaPausedAt} />
        </>
      ) : (
        'Paused'
      )
    };
  }

  const dueMs = new Date(ticket.dueAt).getTime() - Date.now();
  if (dueMs < 0) {
    return {
      label: 'Breached',
      tone: 'border-rose-200 bg-rose-100 text-rose-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.dueAt} />
        </>
      )
    };
  }
  if (dueMs <= SLA_RISK_WINDOW_MS) {
    return {
      label: 'At risk',
      tone: 'border-amber-200 bg-amber-100 text-amber-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.dueAt} />
        </>
      )
    };
  }
  return {
    label: 'On track',
    tone: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    detail: (
      <>
        Due <RelativeTime value={ticket.dueAt} />
      </>
    )
  };
}
