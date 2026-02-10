import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, Check, ChevronDown, Clock3, Copy, MessageSquare, Paperclip, Search } from 'lucide-react';
import {
  addTicketMessage,
  ApiError,
  assignTicket,
  downloadAttachment,
  followTicket,
  fetchTeamMembers,
  fetchTicketById,
  fetchTicketEvents,
  fetchTicketMessages,
  transitionTicket,
  transferTicket,
  unfollowTicket,
  uploadTicketAttachment,
  type NotificationRecord,
  type TeamMember,
  type TeamRef,
  type TicketDetail,
  type TicketEvent,
  type TicketMessage,
} from '../api/client';
import { CustomFieldsDisplay } from '../components/CustomFieldRenderer';
import { MessageBody } from '../components/MessageBody';
import { RelativeTime } from '../components/RelativeTime';
import { TicketDetailSkeleton } from '../components/skeletons';
import type { Role } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { formatStatus, formatTicketId, initialsFor } from '../utils/format';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  TRIAGED: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  WAITING_ON_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_VENDOR: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['REOPENED', 'CLOSED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
};

export function TicketDetailPage({
  refreshKey,
  currentEmail,
  role,
  teamsList,
  headerProps,
}: {
  refreshKey: number;
  currentEmail: string;
  role: Role;
  teamsList: TeamRef[];
  headerProps?: {
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
}) {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [activeTab, setActiveTab] = useState<'conversation' | 'timeline'>('conversation');
  const [messageType, setMessageType] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [messageBody, setMessageBody] = useState('');
  const [messageSending, setMessageSending] = useState(false);

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

  const [copyToast, setCopyToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [interfaceMode, setInterfaceMode] = useState('Agent View');
  const [expandedSections, setExpandedSections] = useState({
    edit: true,
    followers: false,
    additional: false,
    history: false,
  });

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);

  const activeTicketIdRef = useRef<string | null>(null);
  const detailRequestSeqRef = useRef(0);
  const messageRequestSeqRef = useRef(0);
  const eventRequestSeqRef = useRef(0);

  const followers = ticket?.followers ?? [];
  const statusEvents = events.filter((event) => event.type === 'TICKET_STATUS_CHANGED');
  const isFollowing = followers.some((follower) => follower.user.email === currentEmail);
  const canManage = role !== 'EMPLOYEE';
  const canUpload = ticket ? role !== 'EMPLOYEE' || ticket.requester?.email === currentEmail : false;
  const availableTransitions = useMemo(() => {
    if (!ticket) {
      return [];
    }
    return STATUS_TRANSITIONS[ticket.status] ?? [];
  }, [ticket]);
  const headerTitle = headerProps?.title ?? 'Ticket details';

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    void loadTicketDetail(ticketId);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.id, messages.length]);

  useEffect(() => {
    if (role === 'EMPLOYEE') {
      setMessageType('PUBLIC');
    }
  }, [role]);

  useEffect(() => {
    if (!copyToast) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setCopyToast(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [copyToast]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (isInput) return;

      switch (event.key) {
        case 'r':
        case 'R':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            messageInputRef.current?.focus();
          }
          break;
        case 'a':
        case 'A':
          if (!event.ctrlKey && !event.metaKey && !event.altKey && canManage && !ticket?.assignee) {
            event.preventDefault();
            void handleAssignSelf();
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
  }, [canManage, navigate, ticket?.assignee]);

  async function loadMessagesPage(id: string, reset = false) {
    const requestSeq = ++messageRequestSeqRef.current;
    if (reset) {
      setMessages([]);
      setMessageCursor(null);
      setMessagesHasMore(false);
    }

    setMessagesLoading(true);
    try {
      const response = await fetchTicketMessages(id, {
        cursor: reset ? undefined : messageCursor ?? undefined,
        take: 50,
      });
      if (messageRequestSeqRef.current !== requestSeq) {
        return;
      }
      setMessages((prev) => (reset ? response.data : [...response.data, ...prev]));
      setMessageCursor(response.nextCursor ?? null);
      setMessagesHasMore(Boolean(response.nextCursor));
    } catch {
      if (messageRequestSeqRef.current === requestSeq && reset) {
        setMessages([]);
        setMessagesHasMore(false);
      }
    } finally {
      if (messageRequestSeqRef.current === requestSeq) {
        setMessagesLoading(false);
      }
    }
  }

  async function loadEventsPage(id: string, reset = false) {
    const requestSeq = ++eventRequestSeqRef.current;
    if (reset) {
      setEvents([]);
      setEventCursor(null);
      setEventsHasMore(false);
    }

    setEventsLoading(true);
    try {
      const response = await fetchTicketEvents(id, {
        cursor: reset ? undefined : eventCursor ?? undefined,
        take: 50,
      });
      if (eventRequestSeqRef.current !== requestSeq) {
        return;
      }
      setEvents((prev) => (reset ? response.data : [...response.data, ...prev]));
      setEventCursor(response.nextCursor ?? null);
      setEventsHasMore(Boolean(response.nextCursor));
    } catch {
      if (eventRequestSeqRef.current === requestSeq && reset) {
        setEvents([]);
        setEventsHasMore(false);
      }
    } finally {
      if (eventRequestSeqRef.current === requestSeq) {
        setEventsLoading(false);
      }
    }
  }

  async function loadTicketDetail(id: string) {
    const requestSeq = ++detailRequestSeqRef.current;
    const isNavigatingToDifferentTicket = activeTicketIdRef.current !== null && activeTicketIdRef.current !== id;
    activeTicketIdRef.current = id;

    setLoadingDetail(true);
    setTicketError(null);
    setAccessDenied(false);

    if (isNavigatingToDifferentTicket) {
      setTicket(null);
      setMessages([]);
      setEvents([]);
      setMessageCursor(null);
      setEventCursor(null);
      setMessagesHasMore(false);
      setEventsHasMore(false);
    }

    try {
      const detail = await fetchTicketById(id);
      if (detailRequestSeqRef.current !== requestSeq) {
        return;
      }

      setTicket(detail);
      await Promise.all([loadMessagesPage(id, true), loadEventsPage(id, true)]);
    } catch (error) {
      if (detailRequestSeqRef.current !== requestSeq) {
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setAccessDenied(true);
        setTicketError('You do not have access to this ticket.');
      } else {
        setTicketError('Unable to load ticket details.');
      }
      if (isNavigatingToDifferentTicket) {
        setTicket(null);
      }
    } finally {
      if (detailRequestSeqRef.current === requestSeq) {
        setLoadingDetail(false);
      }
    }
  }

  async function handleCopyLink() {
    if (!ticketId) {
      return;
    }
    const url = `${window.location.origin}/tickets/${ticketId}`;
    const copied = await copyToClipboard(url);
    if (copied) {
      setCopyToast({ message: 'Link copied to clipboard', type: 'success' });
      return;
    }
    setCopyToast({ message: 'Could not copy link', type: 'error' });
  }

  async function handleReply() {
    const body = messageBody.trim();
    if (!ticketId || !ticket || !body || messageSending) {
      return;
    }

    setTicketError(null);
    setMessageSending(true);

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMessage: TicketMessage = {
      id: optimisticId,
      body,
      type: messageType,
      createdAt: new Date().toISOString(),
      author: {
        id: 'pending',
        email: currentEmail,
        displayName: currentEmail.split('@')[0] || 'You',
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageBody('');

    try {
      const serverMessage = await addTicketMessage(ticketId, { body, type: messageType });
      setMessages((prev) => prev.map((item) => (item.id === optimisticId ? serverMessage : item)));
      void loadEventsPage(ticketId, true);
    } catch {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setTicketError('Unable to send message.');
    } finally {
      setMessageSending(false);
    }
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
      void loadTicketDetail(ticket.id);
    } catch {
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
      void loadTicketDetail(ticket.id);
    } catch {
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
      void loadTicketDetail(ticket.id);
    } catch {
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
        assigneeId: transferAssigneeId || undefined,
      });
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      void loadTicketDetail(ticket.id);
    } catch {
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
      void loadTicketDetail(ticket.id);
    } catch {
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
      void loadTicketDetail(ticketId);
    } catch {
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
    } catch {
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
    } catch {
      setAttachmentError('Unable to open attachment.');
    }
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  const firstAttachment = ticket?.attachments[0] ?? null;

  return (
    <section className="min-w-0 bg-gray-50" title={headerTitle}>
      {copyToast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              copyToast.type === 'success'
                ? 'border-green-200 bg-white text-gray-900'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {copyToast.type === 'success' ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <Clock3 className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">{copyToast.message}</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/tickets')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to tickets
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={headerProps?.onOpenSearch}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              <select
                value={interfaceMode}
                onChange={(event) => setInterfaceMode(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                aria-label="View mode"
              >
                <option>Agent View</option>
                <option>Manager View</option>
              </select>
              <button type="button" className="relative p-2 text-gray-600 hover:text-gray-900" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {initialsFor(headerProps?.currentEmail ?? currentEmail)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {ticket && (
        <div className="border-b border-gray-200 bg-white">
          <div className="px-6 py-4">
            <div className="mb-3 flex items-start justify-between">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{formatTicketId(ticket)}</span>
                <span className="text-gray-300">|</span>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass(ticket.status)}`}>
                  {formatStatus(ticket.status)}
                </span>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${priorityBadgeClass(ticket.priority)}`}>
                  {formatPriority(ticket.priority)}
                </span>
                <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                  {formatChannel(ticket.channel)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <Copy className="mr-1 h-4 w-4" />
                Copy link
              </button>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-gray-900">{ticket.subject}</h1>
            {ticket.description && <p className="mb-3 text-sm text-gray-600">{ticket.description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 sm:gap-4">
              <span>
                Created <RelativeTime value={ticket.createdAt} />
              </span>
              <span className="hidden sm:inline">•</span>
              <span>
                Requester: <span className="text-gray-900">{ticket.requester?.displayName ?? ticket.requester?.email ?? 'Unknown'}</span>
              </span>
              <span className="hidden sm:inline">•</span>
              <span>
                Assignee: <span className="text-gray-900">{ticket.assignee?.displayName ?? 'Unassigned'}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {ticketError && <p className="mb-4 text-sm text-red-600">{ticketError}</p>}
        {accessDenied && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm">Switch to a user with access, or go back to the ticket list.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-6">
                    <button
                      type="button"
                      onClick={() => setActiveTab('conversation')}
                      className={`pb-3 px-1 text-sm font-medium ${
                        activeTab === 'conversation'
                          ? 'border-b-2 border-blue-500 text-blue-500'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Conversation
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('timeline')}
                      className={`pb-3 px-1 text-sm font-medium ${
                        activeTab === 'timeline'
                          ? 'border-b-2 border-blue-500 text-blue-500'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Timeline
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 pb-2 text-xs text-gray-500">
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1">R</kbd>
                    <span>Reply</span>
                    {canManage && (
                      <>
                        <span className="mx-1">•</span>
                        <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1">A</kbd>
                        <span>Assign</span>
                        <span className="mx-1">•</span>
                        <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1">S</kbd>
                        <span>Status</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingDetail && !ticket && <TicketDetailSkeleton count={4} />}
                {!loadingDetail && !ticket && !accessDenied && <p className="text-sm text-gray-500">Ticket not found.</p>}

                {ticket && activeTab === 'conversation' && (
                  <>
                    <div className="mb-6 max-h-[600px] space-y-4 overflow-y-auto">
                      {messagesHasMore && (
                        <button
                          type="button"
                          onClick={() => ticketId && void loadMessagesPage(ticketId)}
                          disabled={messagesLoading}
                          className="mb-4 text-sm text-blue-600 hover:text-blue-700"
                        >
                          {messagesLoading ? 'Loading...' : '↑ Load older messages'}
                        </button>
                      )}

                      {messages.length === 0 && !messagesLoading && (
                        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                          No messages yet.
                        </div>
                      )}

                      {messages.map((message) => {
                        const isCurrentUser = message.author?.email === currentEmail;
                        const isInternal = message.type === 'INTERNAL';
                        const isRequester =
                          message.author?.id === ticket.requester?.id ||
                          message.author?.email === ticket.requester?.email;

                        return (
                          <div key={message.id}>
                            <div className={`flex items-start gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  isRequester ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {initialsFor(message.author?.displayName ?? message.author?.email ?? 'U')}
                              </div>
                              <div className={`flex-1 ${isCurrentUser ? 'text-right' : ''}`}>
                                <div className={`mb-1 flex items-center gap-2 ${isCurrentUser ? 'justify-end' : ''}`}>
                                  <span className="text-sm font-medium text-gray-900">
                                    {message.author?.displayName ?? message.author?.email ?? 'Unknown'}
                                  </span>
                                  {isInternal && (
                                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                      Internal
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    <RelativeTime value={message.createdAt} />
                                  </span>
                                </div>
                                <div
                                  className={`inline-block rounded-lg p-3 ${
                                    isInternal
                                      ? 'border border-yellow-200 bg-yellow-50 text-gray-900'
                                      : isCurrentUser
                                        ? 'bg-blue-50 text-gray-900'
                                        : 'bg-gray-50 text-gray-900'
                                  }`}
                                >
                                  <MessageBody body={message.body} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMessageType('PUBLIC')}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                              messageType === 'PUBLIC'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Public Reply
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setMessageType('INTERNAL')}
                              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                messageType === 'INTERNAL'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Internal Note
                            </button>
                          )}
                        </div>
                        {canUpload && (
                          <label className="cursor-pointer text-gray-600 hover:text-gray-900">
                            <Paperclip className="h-5 w-5" />
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

                      <textarea
                        ref={messageInputRef}
                        value={messageBody}
                        onChange={(event) => setMessageBody(event.target.value)}
                        placeholder={messageType === 'INTERNAL' ? 'Type internal note...' : 'Type your message...'}
                        rows={4}
                        className="w-full resize-none rounded-md border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {firstAttachment ? (
                            <>
                              Attachments:{' '}
                              <button
                                type="button"
                                onClick={() => void handleAttachmentView(firstAttachment.id)}
                                className="text-blue-600 hover:underline"
                              >
                                {firstAttachment.fileName}
                              </button>{' '}
                              <button
                                type="button"
                                onClick={() => void handleAttachmentDownload(firstAttachment.id, firstAttachment.fileName)}
                                className="text-blue-600 hover:underline"
                              >
                                download
                              </button>{' '}
                              ({formatFileSize(firstAttachment.sizeBytes)})
                              {ticket.attachments.length > 1 && ` +${ticket.attachments.length - 1} more`}
                            </>
                          ) : (
                            'Attachments: None'
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleReply()}
                          disabled={!messageBody.trim() || messageSending}
                          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {messageSending ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                      {attachmentError && <p className="mt-2 text-xs text-red-600">{attachmentError}</p>}
                    </div>
                  </>
                )}

                {ticket && activeTab === 'timeline' && (
                  <div className="max-h-[600px] space-y-4 overflow-y-auto">
                    {eventsHasMore && (
                      <button
                        type="button"
                        onClick={() => ticketId && void loadEventsPage(ticketId)}
                        disabled={eventsLoading}
                        className="mb-4 text-sm text-blue-600 hover:text-blue-700"
                      >
                        {eventsLoading ? 'Loading...' : '↑ Load older events'}
                      </button>
                    )}

                    {events.length === 0 && !eventsLoading && (
                      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                        No events yet.
                      </div>
                    )}

                    {events.map((event, index) => {
                      const eventKind = getEventKind(event);
                      return (
                        <div key={event.id} className="flex items-start gap-3">
                          <div className="relative">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                eventKind === 'message'
                                  ? 'bg-blue-100'
                                  : eventKind === 'internal'
                                    ? 'bg-yellow-100'
                                    : 'bg-gray-100'
                              }`}
                            >
                              {eventKind === 'message' || eventKind === 'internal' ? (
                                <MessageSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Clock3 className="h-4 w-4 text-gray-600" />
                              )}
                            </div>
                            {index < events.length - 1 && <div className="absolute left-4 top-8 h-8 w-px bg-gray-200" />}
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-sm text-gray-900">{formatEventText(event)}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              <RelativeTime value={event.createdAt} />
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4 xl:col-span-1">
            {ticket && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">SLA Overview</h3>
                <div className="space-y-3">
                  {renderSlaCard('First Response', getFirstResponseSla(ticket))}
                  {renderSlaCard('Resolution SLA', getResolutionSla(ticket))}
                </div>
              </div>
            )}

            {canManage && (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSection('edit')}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Edit Ticket</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${expandedSections.edit ? 'rotate-180' : ''}`}
                  />
                </button>

                {expandedSections.edit && (
                  <div className="space-y-4 px-4 pb-4">
                    {actionError && <p className="text-xs text-red-600">{actionError}</p>}

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Assign to</label>
                      <div className="flex space-x-2">
                        <select
                          value={assignToId}
                          onChange={(event) => setAssignToId(event.target.value)}
                          disabled={membersLoading || actionLoading || teamMembers.length === 0}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">{membersLoading ? 'Loading team...' : 'Select assignee'}</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.user.id}>
                              {member.user.displayName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleAssignMember()}
                          disabled={!assignToId || actionLoading}
                          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                      {!ticket?.assignee && (
                        <button
                          type="button"
                          onClick={() => void handleAssignSelf()}
                          disabled={actionLoading}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          Assign to me
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Change status</label>
                      <div className="flex space-x-2">
                        <select
                          ref={statusSelectRef}
                          value={nextStatus}
                          onChange={(event) => setNextStatus(event.target.value)}
                          disabled={actionLoading || availableTransitions.length === 0}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                          onClick={() => void handleTransition()}
                          disabled={actionLoading || !nextStatus || nextStatus === ticket?.status}
                          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                        >
                          Update
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Transfer to</label>
                      <div className="space-y-2">
                        <select
                          value={transferTeamId}
                          onChange={(event) => setTransferTeamId(event.target.value)}
                          disabled={actionLoading}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select department</option>
                          {teamsList.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={transferAssigneeId}
                          onChange={(event) => setTransferAssigneeId(event.target.value)}
                          disabled={actionLoading || !transferTeamId}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select assignee</option>
                          {transferMembers.map((member) => (
                            <option key={member.id} value={member.user.id}>
                              {member.user.displayName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleTransfer()}
                          disabled={actionLoading || !transferTeamId || transferTeamId === ticket?.assignedTeam?.id}
                          className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                        >
                          Transfer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Ticket Details</h3>
              <TicketDetailsCard ticket={ticket} loading={loadingDetail} />
            </div>

            {ticket && (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSection('followers')}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Followers ({followers.length})</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      expandedSections.followers ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.followers && (
                  <div className="px-4 pb-4">
                    <div className="mb-3 space-y-2">
                      {followers.length === 0 && <p className="text-xs text-gray-500">No followers yet.</p>}
                      {followers.map((follower) => (
                        <div key={follower.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                              {initialsFor(follower.user.displayName)}
                            </div>
                            <span className="text-sm text-gray-900">{follower.user.displayName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleFollowToggle()}
                      disabled={followLoading}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {isFollowing ? 'Unfollow this ticket' : '+ Follow this ticket'}
                    </button>
                    {followError && <p className="mt-2 text-xs text-red-600">{followError}</p>}
                  </div>
                )}
              </div>
            )}

            {ticket && (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSection('additional')}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Additional Details</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      expandedSections.additional ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.additional && (
                  <div className="space-y-2 px-4 pb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reference ID</span>
                      <span className="text-gray-900">{formatTicketId(ticket)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Source IP</span>
                      <span className="text-gray-900">192.168.1.1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Browser</span>
                      <span className="text-gray-900">Chrome 120</span>
                    </div>
                    {ticket.customFieldValues && ticket.customFieldValues.length > 0 && (
                      <div className="pt-2">
                        <CustomFieldsDisplay values={ticket.customFieldValues} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {ticket && (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSection('history')}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Status History</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${expandedSections.history ? 'rotate-180' : ''}`}
                  />
                </button>

                {expandedSections.history && (
                  <div className="space-y-3 px-4 pb-4">
                    {statusEvents.length === 0 && <p className="text-xs text-gray-500">No status changes recorded yet.</p>}

                    {statusEvents.map((event) => {
                      const payload = (event.payload ?? {}) as { from?: string; to?: string };
                      const actor = event.createdBy?.displayName ?? event.createdBy?.email ?? 'System';
                      return (
                        <div key={event.id} className="text-xs">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-gray-600">
                              {payload.from ? formatStatus(payload.from) : 'Unknown'} →{' '}
                              {payload.to ? formatStatus(payload.to) : formatStatus(ticket.status)}
                            </span>
                            <span className="text-gray-500">
                              <RelativeTime value={event.createdAt} />
                            </span>
                          </div>
                          <p className="text-gray-500">By {actor}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function TicketDetailsCard({ ticket, loading }: { ticket: TicketDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-100" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-3/4 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Requester</span>
        <span className="font-medium text-gray-900">{ticket.requester?.displayName ?? 'Unknown'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Email</span>
        <span className="text-gray-900">{ticket.requester?.email ?? '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Department</span>
        <span className="text-gray-900">{ticket.assignedTeam?.name ?? 'Unassigned'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Assignee</span>
        <span className="font-medium text-gray-900">{ticket.assignee?.displayName ?? 'Unassigned'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Category</span>
        <span className="text-gray-900">{ticket.category?.name ?? 'None'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Created</span>
        <span className="text-gray-900">
          <RelativeTime value={ticket.createdAt} />
        </span>
      </div>
    </div>
  );
}

const SLA_RISK_WINDOW_MS = 4 * 60 * 60 * 1000;
const SLA_FIRST_RESPONSE_RISK_MS = 2 * 60 * 60 * 1000;

function renderSlaCard(label: string, sla: { label: string; tone: string; detail: ReactNode }) {
  return (
    <div className={`rounded-md border p-3 ${sla.tone}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs">{sla.label}</span>
      </div>
      <p className="text-xs">{sla.detail}</p>
    </div>
  );
}

function getFirstResponseSla(ticket: TicketDetail) {
  if (ticket.firstResponseAt) {
    return {
      label: 'Met',
      tone: 'border-green-200 bg-green-50 text-green-700',
      detail: (
        <>
          Responded <RelativeTime value={ticket.firstResponseAt} />
        </>
      ),
    };
  }

  if (!ticket.firstResponseDueAt) {
    return {
      label: 'Not set',
      tone: 'border-gray-200 bg-gray-100 text-gray-600',
      detail: 'No SLA configured',
    };
  }

  const dueMs = new Date(ticket.firstResponseDueAt).getTime() - Date.now();
  if (dueMs < 0) {
    return {
      label: 'Breached',
      tone: 'border-red-200 bg-red-50 text-red-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.firstResponseDueAt} />
        </>
      ),
    };
  }

  if (dueMs <= SLA_FIRST_RESPONSE_RISK_MS) {
    return {
      label: 'At Risk',
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.firstResponseDueAt} />
        </>
      ),
    };
  }

  return {
    label: 'Open',
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
    detail: (
      <>
        Due <RelativeTime value={ticket.firstResponseDueAt} />
      </>
    ),
  };
}

function getResolutionSla(ticket: TicketDetail) {
  if (ticket.completedAt) {
    return {
      label: 'Met',
      tone: 'border-green-200 bg-green-50 text-green-700',
      detail: (
        <>
          Completed <RelativeTime value={ticket.completedAt} />
        </>
      ),
    };
  }

  if (!ticket.dueAt) {
    return {
      label: 'Not set',
      tone: 'border-gray-200 bg-gray-100 text-gray-600',
      detail: 'No SLA configured',
    };
  }

  const isPaused = ticket.status === 'WAITING_ON_REQUESTER' || ticket.status === 'WAITING_ON_VENDOR';
  if (isPaused) {
    return {
      label: 'Paused',
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
      detail: ticket.slaPausedAt ? (
        <>
          Paused <RelativeTime value={ticket.slaPausedAt} />
        </>
      ) : (
        'Paused'
      ),
    };
  }

  const dueMs = new Date(ticket.dueAt).getTime() - Date.now();
  if (dueMs < 0) {
    return {
      label: 'Breached',
      tone: 'border-red-200 bg-red-50 text-red-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.dueAt} />
        </>
      ),
    };
  }

  if (dueMs <= SLA_RISK_WINDOW_MS) {
    return {
      label: 'At Risk',
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
      detail: (
        <>
          Due <RelativeTime value={ticket.dueAt} />
        </>
      ),
    };
  }

  return {
    label: 'On Track',
    tone: 'border-green-200 bg-green-50 text-green-700',
    detail: (
      <>
        Due <RelativeTime value={ticket.dueAt} />
      </>
    ),
  };
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

function formatPriority(priority?: string | null) {
  const value = (priority ?? '').toUpperCase();
  switch (value) {
    case 'P1':
    case 'URGENT':
      return 'Urgent';
    case 'P2':
    case 'HIGH':
      return 'High';
    case 'P3':
    case 'MEDIUM':
      return 'Medium';
    case 'P4':
    case 'LOW':
      return 'Low';
    default:
      return priority ?? 'Unknown';
  }
}

function priorityBadgeClass(priority?: string | null) {
  const label = formatPriority(priority);
  if (label === 'Urgent') return 'bg-red-100 text-red-700';
  if (label === 'High') return 'bg-orange-100 text-orange-700';
  if (label === 'Medium') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
}

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case 'NEW':
      return 'bg-blue-100 text-blue-800';
    case 'TRIAGED':
    case 'ASSIGNED':
    case 'IN_PROGRESS':
    case 'WAITING_ON_REQUESTER':
    case 'WAITING_ON_VENDOR':
      return 'bg-yellow-100 text-yellow-800';
    case 'RESOLVED':
    case 'CLOSED':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatChannel(channel?: string | null) {
  if (!channel) {
    return 'Unknown';
  }
  return channel
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getEventKind(event: TicketEvent) {
  if (event.type === 'MESSAGE_ADDED') {
    const payload = (event.payload ?? {}) as { type?: string };
    return payload.type === 'INTERNAL' ? 'internal' : 'message';
  }
  return 'default';
}

function formatEventText(event: TicketEvent) {
  const actor = event.createdBy?.displayName ?? event.createdBy?.email ?? 'System';
  const payload = (event.payload ?? {}) as {
    type?: string;
    from?: string;
    to?: string;
    assigneeName?: string | null;
    assigneeEmail?: string | null;
    toTeamName?: string | null;
  };

  switch (event.type) {
    case 'TICKET_CREATED':
      return `Ticket created by ${actor}`;
    case 'TICKET_ASSIGNED':
      return `Assigned to ${payload.assigneeName ?? payload.assigneeEmail ?? 'team member'}`;
    case 'TICKET_STATUS_CHANGED':
      return `Status changed from ${formatStatus(payload.from ?? 'UNKNOWN')} to ${formatStatus(payload.to ?? 'UNKNOWN')}`;
    case 'TICKET_TRANSFERRED':
      return `Transferred to ${payload.toTeamName ?? 'another department'}`;
    case 'TICKET_PRIORITY_CHANGED':
      return `Priority changed from ${formatPriority(payload.from)} to ${formatPriority(payload.to)}`;
    case 'MESSAGE_ADDED':
      return payload.type === 'INTERNAL' ? `${actor} added internal note` : `${actor} replied`;
    default:
      return formatStatus(event.type.replace(/_/g, ' '));
  }
}
