import { Search } from 'lucide-react';
import type { NotificationRecord } from '../api/client';
import { NotificationCenter } from './NotificationCenter';

type NotificationProps = {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onRefresh: () => void;
};

export function TopBar({
  title,
  subtitle,
  currentEmail,
  personas,
  onEmailChange,
  onOpenSearch,
  notificationProps
}: {
  title: string;
  subtitle: string;
  currentEmail: string;
  personas: { label: string; email: string }[];
  onEmailChange: (email: string) => void;
  onOpenSearch?: () => void;
  notificationProps?: NotificationProps;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Search Button */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition"
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-xs text-slate-400">⌘K</kbd>
          </button>
        )}

        <select
          className="px-3 py-2 rounded-full border border-slate-300 bg-white text-sm text-slate-700"
          value={currentEmail}
          onChange={(event) => onEmailChange(event.target.value)}
        >
          {personas.map((persona) => (
            <option key={persona.email} value={persona.email}>
              {persona.label}
            </option>
          ))}
        </select>

        {/* Notification Center - end right */}
        {notificationProps && (
          <NotificationCenter
            notifications={notificationProps.notifications}
            unreadCount={notificationProps.unreadCount}
            loading={notificationProps.loading}
            hasMore={notificationProps.hasMore}
            onLoadMore={notificationProps.onLoadMore}
            onMarkAsRead={notificationProps.onMarkAsRead}
            onMarkAllAsRead={notificationProps.onMarkAllAsRead}
            onRefresh={notificationProps.onRefresh}
          />
        )}
      </div>
    </header>
  );
}
