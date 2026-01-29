import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  AlertTriangle,
  Clock,
  UserPlus,
  ArrowRightLeft,
  CheckCircle,
  X
} from 'lucide-react';
import type { NotificationRecord } from '../api/client';
import { formatTicketId } from '../utils/format';

type NotificationCenterProps = {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onRefresh: () => void;
};

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TICKET_ASSIGNED':
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'NEW_MESSAGE':
      return <MessageSquare className="h-4 w-4 text-emerald-500" />;
    case 'SLA_AT_RISK':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'SLA_BREACHED':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'TICKET_RESOLVED':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'TICKET_TRANSFERRED':
      return <ArrowRightLeft className="h-4 w-4 text-purple-500" />;
    case 'TICKET_MENTIONED':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    default:
      return <Bell className="h-4 w-4 text-slate-500" />;
  }
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({
  notifications,
  unreadCount,
  loading,
  hasMore,
  onLoadMore,
  onMarkAsRead,
  onMarkAllAsRead,
  onRefresh
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Refresh when opening
  useEffect(() => {
    if (isOpen) {
      onRefresh();
    }
  }, [isOpen, onRefresh]);

  function handleNotificationClick(notification: NotificationRecord) {
    // Mark as read
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }

    // Navigate to ticket if present
    if (notification.ticket) {
      setIsOpen(false);
      navigate(`/tickets/${notification.ticket.id}`);
    }
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-400 transition"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl z-50"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-slate-200" />
                      <div className="h-2 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-12 px-4 text-center">
                <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  You'll be notified about ticket updates here
                </p>
              </div>
            )}

            {notifications.map((notification) => (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
                aria-label={`${notification.title}${!notification.isRead ? ', unread' : ''}`}
                className={`group w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 cursor-pointer ${
                  !notification.isRead ? 'bg-blue-50/50' : ''
                }`}
              >
                {/* Icon */}
                <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !notification.isRead ? 'bg-white shadow-sm' : 'bg-slate-100'
                }`}>
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {notification.body}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                    {notification.ticket && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTicketId(notification.ticket)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Unread Indicator */}
                {!notification.isRead && (
                  <div className="mt-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}

                {/* Mark as read button */}
                {!notification.isRead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead(notification.id);
                    }}
                    className="mt-1 h-6 w-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    aria-label="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Load More */}
            {hasMore && notifications.length > 0 && (
              <div className="p-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loading}
                  className="w-full py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
