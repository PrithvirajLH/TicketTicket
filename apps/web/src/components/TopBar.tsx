import { ChevronDown, Search } from 'lucide-react';
import type { NotificationRecord } from '../api/client';
import { initialsFor } from '../utils/format';
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
  const avatarSeed = currentEmail.split('@')[0]?.replace(/[._-]+/g, ' ') || currentEmail;
  const avatarInitials = initialsFor(avatarSeed);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Button */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden sm:inline-flex min-w-[220px] items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-card transition hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
          </button>
        )}

        <div className="relative">
          <select
            className="appearance-none rounded-full border border-border bg-card px-4 py-2 pr-10 text-sm font-semibold text-foreground shadow-card"
            value={currentEmail}
            onChange={(event) => onEmailChange(event.target.value)}
          >
            {personas.map((persona) => (
              <option key={persona.email} value={persona.email}>
                {persona.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {avatarInitials}
        </div>

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
            unreadOnly={true}
          />
        )}
      </div>
    </header>
  );
}
