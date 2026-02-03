import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Eye, Layers, Ticket as TicketIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTicketActivity, fetchTickets, type NotificationRecord, type TicketActivityPoint, type TicketRecord } from '../api/client';
import { RelativeTime } from '../components/RelativeTime';
import { TopBar } from '../components/TopBar';
import { KPICard } from '../components/dashboard/KPICard';
import { StatusBadge } from '../components/dashboard/StatusBadge';
import { TicketActivityChart, type ActivityPoint } from '../components/dashboard/TicketActivityChart';
import { formatStatus, formatTicketId } from '../utils/format';
import type { DashboardStats, Role } from '../types';

const RECENT_TICKETS_COUNT = 6;
function mapActivitySeries(data: TicketActivityPoint[]): ActivityPoint[] {
  return data.map((point) => ({
    ...point,
    day: new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
  }));
}

function priorityBadgeStyle(priority?: string | null) {
  switch (priority) {
    case 'P1':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'P2':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'P3':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'P4':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function formatDueLabel(dueAt?: string | null) {
  if (!dueAt) return null;
  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) return null;
  const diffMs = dueTime - Date.now();
  const absMs = Math.abs(diffMs);
  const hours = Math.max(1, Math.round(absMs / (1000 * 60 * 60)));
  if (diffMs < 0) {
    const label = hours >= 24 ? `Overdue ${Math.round(hours / 24)}d` : `Overdue ${hours}h`;
    return { label, className: 'bg-rose-100 text-rose-700 border-rose-200', asChip: true };
  }
  if (hours <= 4) {
    return { label: `Due in ${hours}h`, className: 'bg-amber-100 text-amber-700 border-amber-200', asChip: true };
  }
  if (hours >= 24) {
    return { label: `Due in ${Math.round(hours / 24)}d`, className: 'text-slate-500', asChip: false };
  }
  return { label: `Due in ${hours}h`, className: 'text-slate-500', asChip: false };
}

function formatSlaBadge(ticket: TicketRecord) {
  const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  if (isClosed) {
    if (ticket.dueAt && ticket.completedAt) {
      const due = new Date(ticket.dueAt).getTime();
      const completed = new Date(ticket.completedAt).getTime();
      if (!Number.isNaN(due) && !Number.isNaN(completed) && completed > due) {
        return { label: 'SLA breached', className: 'bg-rose-100 text-rose-700 border-rose-200', asChip: true };
      }
    }
    return null;
  }
  return formatDueLabel(ticket.dueAt);
}

function activitySummary(ticket: TicketRecord): ReactNode {
  const status = formatStatus(ticket.status);
  const actor = ticket.assignee?.displayName ?? ticket.assignee?.email ?? ticket.assignedTeam?.name ?? 'System';
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return (
      <span>
        Resolved by <span className="font-semibold text-slate-700">{actor}</span>
      </span>
    );
  }
  if (ticket.status === 'WAITING_ON_REQUESTER') {
    return (
      <span>
        Waiting on requester — <span className="font-semibold text-slate-700">{actor}</span>
      </span>
    );
  }
  if (ticket.status === 'WAITING_ON_VENDOR') {
    return (
      <span>
        Waiting on vendor — <span className="font-semibold text-slate-700">{actor}</span>
      </span>
    );
  }
  return (
    <span>
      Status changed to {status} by <span className="font-semibold text-slate-700">{actor}</span>
    </span>
  );
}

type DashboardHeaderProps = {
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

type DashboardPageProps = {
  refreshKey: number;
  role: Role;
  headerProps?: DashboardHeaderProps;
};

export function DashboardPage({ refreshKey, role, headerProps }: DashboardPageProps) {
  const navigate = useNavigate();
  const [recentTickets, setRecentTickets] = useState<TicketRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ open: 0, resolved: 0, total: 0 });
  const [activitySeries, setActivitySeries] = useState<ActivityPoint[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const isEmployee = role === 'EMPLOYEE';
  const [activityRange, setActivityRange] = useState<'3' | '7' | '30'>(isEmployee ? '3' : '7');
  const [onlyMyTickets, setOnlyMyTickets] = useState(false);
  const [activitySort, setActivitySort] = useState<'recent' | 'oldest'>('recent');

  useEffect(() => {
    if (isEmployee) {
      setActivityRange('3');
      setOnlyMyTickets(false);
      setActivitySort('recent');
    }
  }, [isEmployee]);

  useEffect(() => {
    let isActive = true;
    const emptyTicketResponse = {
      data: [] as TicketRecord[],
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
    };

    const loadDashboard = async () => {
      setLoadingDashboard(true);
      try {
        if (isEmployee) {
          const rangeDays = Number(activityRange);
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - rangeDays);
          const updatedFrom = fromDate.toISOString();
          const toDate = new Date();
          const updatedTo = toDate.toISOString().slice(0, 10);

          const order = activitySort === 'oldest' ? 'asc' : 'desc';

          const [recentResponse, openResponse, resolvedResponse] = await Promise.all([
            fetchTickets({
              pageSize: RECENT_TICKETS_COUNT,
              sort: 'updatedAt',
              order,
              scope: 'created',
              updatedFrom,
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'open',
              scope: 'created',
              updatedFrom,
              updatedTo,
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'resolved',
              scope: 'created',
              updatedFrom,
              updatedTo,
            }).catch(() => emptyTicketResponse),
          ]);

          if (!isActive) return;

          setRecentTickets(recentResponse.data);
          const openCount = openResponse.meta.total;
          const resolvedCount = resolvedResponse.meta.total;
          setDashboardStats({
            open: openCount,
            resolved: resolvedCount,
            total: openCount + resolvedCount,
          });
          setActivitySeries([]);
        } else {
          const rangeDays = Number(activityRange);
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - rangeDays);
          const updatedFrom = fromDate.toISOString();
          const toDate = new Date();
          const activityFrom = fromDate.toISOString().slice(0, 10);
          const activityTo = toDate.toISOString().slice(0, 10);
          const scope = onlyMyTickets ? 'assigned' : undefined;
          const order = activitySort === 'oldest' ? 'asc' : 'desc';

          const [recentResponse, openResponse, resolvedResponse, activityResponse] = await Promise.all([
            fetchTickets({
              pageSize: RECENT_TICKETS_COUNT,
              sort: 'updatedAt',
              order,
              updatedFrom,
              ...(scope ? { scope } : {}),
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'open',
              updatedFrom,
              updatedTo: activityTo,
              ...(scope ? { scope } : {}),
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'resolved',
              updatedFrom,
              updatedTo: activityTo,
              ...(scope ? { scope } : {}),
            }).catch(() => emptyTicketResponse),
            fetchTicketActivity({
              from: activityFrom,
              to: activityTo,
              ...(scope ? { scope } : {}),
            }).catch(() => ({ data: [] })),
          ]);

          if (!isActive) return;

          setRecentTickets(recentResponse.data);
          const openCount = openResponse.meta.total;
          const resolvedCount = resolvedResponse.meta.total;
          setDashboardStats({
            open: openCount,
            resolved: resolvedCount,
            total: openCount + resolvedCount,
          });
          setActivitySeries(mapActivitySeries(activityResponse.data));
        }
      } catch (error) {
        if (!isActive) return;
        setRecentTickets([]);
        setDashboardStats({ open: 0, resolved: 0, total: 0 });
        setActivitySeries([]);
      } finally {
        if (isActive) {
          setLoadingDashboard(false);
        }
      }
    };

    loadDashboard();
    return () => {
      isActive = false;
    };
  }, [refreshKey, isEmployee, activityRange, onlyMyTickets, activitySort]);

  const miniActivityTickets = useMemo(() => recentTickets.slice(0, 3), [recentTickets]);
  const activityRangeLabel =
    activityRange === '3' ? 'Last 3 days' : activityRange === '7' ? 'Last 7 days' : 'Last 30 days';
  const rowGridClass =
    'grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.55fr)_minmax(0,0.3fr)_minmax(0,0.35fr)] items-start gap-3 md:gap-4';

  return (
    <section className="animate-fade-in min-h-full flex flex-col">
      <div className="rounded-2xl bg-background px-5 sm:px-6 lg:px-8 flex-1 min-h-0 flex flex-col">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:p-8 flex-1 min-h-0 flex flex-col">
          {headerProps && (
            <div className="pb-6 border-b border-border">
              <TopBar
                title={headerProps.title}
                subtitle={headerProps.subtitle}
                currentEmail={headerProps.currentEmail}
                personas={headerProps.personas}
                onEmailChange={headerProps.onEmailChange}
                onOpenSearch={headerProps.onOpenSearch}
                notificationProps={headerProps.notificationProps}
              />
            </div>
          )}
          <div className={`grid gap-4 ${isEmployee ? 'sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} ${headerProps ? 'mt-6' : ''} mb-6`}>
            {loadingDashboard
              ? Array.from({ length: isEmployee ? 2 : 3 }).map((_, index) => (
                  <div key={`stat-skeleton-${index}`} className="rounded-xl border border-border bg-card p-6 shadow-card animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted" />
                      <div className="flex-1">
                        <div className="h-6 w-16 rounded bg-muted/70" />
                        <div className="mt-2 h-3 w-24 rounded bg-muted/60" />
                      </div>
                    </div>
                  </div>
                ))
              : (
                <>
                  <KPICard
                    icon={TicketIcon}
                    value={dashboardStats.open}
                    label={isEmployee ? 'My open tickets' : 'Open tickets'}
                    variant="blue"
                  />
                  <KPICard
                    icon={CheckCircle2}
                    value={dashboardStats.resolved}
                    label={isEmployee ? 'My resolved & closed tickets' : 'Resolved & closed'}
                    variant="green"
                  />
                  {!isEmployee && (
                    <KPICard
                      icon={ClipboardList}
                      value={dashboardStats.total}
                      label="Total requests"
                      dropdown={activityRangeLabel}
                    />
                  )}
                </>
              )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className={`grid gap-0 ${isEmployee ? '' : 'lg:grid-cols-5'} divide-y lg:divide-y-0 lg:divide-x divide-border`}>
              <div className={`${isEmployee ? '' : 'lg:col-span-3'} p-6`}>
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold leading-tight text-foreground">Recent activity</h2>
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        Latest updates across your tickets.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card">
                        <span className="text-slate-500">Updated in:</span>
                        <div className="relative">
                          <select
                            className="appearance-none bg-transparent pr-5 text-xs font-semibold text-foreground outline-none focus:outline-none focus:ring-0"
                            value={activityRange}
                            onChange={(event) => setActivityRange(event.target.value as '3' | '7' | '30')}
                            title="Filter by last updated date"
                          >
                            <option value="3">Last 3 days</option>
                            <option value="7">Last 7 days</option>
                            <option value="30">Last 30 days</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card">
                        <span className="text-slate-500">Sort:</span>
                        <div className="relative">
                          <select
                            className="appearance-none bg-transparent pr-5 text-xs font-semibold text-foreground outline-none focus:outline-none focus:ring-0"
                            value={activitySort}
                            onChange={(event) => setActivitySort(event.target.value as 'recent' | 'oldest')}
                          >
                            <option value="recent">Most recent</option>
                            <option value="oldest">Oldest</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>
                      {!isEmployee && (
                        <label className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card cursor-pointer">
                          <span className="text-slate-500">Only my tickets</span>
                          <input
                            type="checkbox"
                            checked={onlyMyTickets}
                            onChange={(event) => setOnlyMyTickets(event.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition-colors duration-200 peer-checked:bg-slate-900">
                            <span className="h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 translate-x-0 group-has-[:checked]:translate-x-4" />
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {loadingDashboard && (
                    <div className="rounded-md border border-border/60 bg-white overflow-hidden">
                      <div className="overflow-auto animate-pulse">
                        <div className="hidden md:grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.55fr)_minmax(0,0.3fr)_minmax(0,0.35fr)] items-center gap-4 px-3 py-2.5 text-sm font-semibold text-slate-700 border-b border-border/80 bg-slate-50 shadow-sm">
                          <span className="min-w-0 truncate" title="Ticket">Ticket</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Details">Details</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Department">Department</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Status">Status</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Updated">Updated</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Created">Created</span>
                        </div>
                        <div className="divide-y divide-border/80">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <div
                              key={`recent-skeleton-${index}`}
                              className={`${rowGridClass} w-full px-3 py-1.5 odd:bg-white even:bg-slate-50/70`}
                            >
                              <div className="min-w-0 space-y-1.5">
                                <div className="h-3 w-48 rounded bg-muted/60" />
                                <div className="h-2.5 w-28 rounded bg-muted/50" />
                                <div className="h-2.5 w-40 rounded bg-muted/40" />
                              </div>
                              <div className="min-w-0 space-y-1.5 md:border-l md:border-border/60 md:pl-4">
                                <div className="h-2.5 w-32 rounded bg-muted/50" />
                                <div className="h-2.5 w-28 rounded bg-muted/40" />
                              </div>
                              <div className="min-w-0 md:border-l md:border-border/60 md:pl-4">
                                <div className="h-2.5 w-24 rounded bg-muted/50" />
                              </div>
                              <div className="min-w-0 md:border-l md:border-border/60 md:pl-4">
                                <div className="h-5 w-24 rounded bg-muted/50" />
                              </div>
                              <div className="min-w-0 md:border-l md:border-border/60 md:pl-4">
                                <div className="h-2.5 w-16 rounded bg-muted/50" />
                              </div>
                              <div className="min-w-0 md:border-l md:border-border/60 md:pl-4">
                                <div className="h-2.5 w-16 rounded bg-muted/50" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!loadingDashboard && recentTickets.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {isEmployee ? 'No recent activity in the last 3 days.' : 'No recent tickets yet.'}
                    </p>
                  )}

                  {!loadingDashboard && recentTickets.length > 0 && (
                    <div className="rounded-md border border-border/60 bg-white min-w-0 overflow-hidden">
                      <div className="min-w-0 overflow-auto">
                        <div className="hidden md:grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.55fr)_minmax(0,0.3fr)_minmax(0,0.35fr)] items-center gap-4 px-3 py-2.5 text-sm font-semibold text-slate-700 border-b border-border/80 bg-slate-50 shadow-sm">
                          <span className="min-w-0 truncate" title="Ticket">Ticket</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Details">Details</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Department">Department</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Status">Status</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Updated">Updated</span>
                          <span className="min-w-0 truncate md:border-l md:border-border/70 md:pl-4" title="Created">Created</span>
                        </div>
                        <div className="divide-y divide-border/80">
                          {recentTickets.map((ticket, index) => {
                            const departmentLabel = ticket.assignedTeam?.name ?? 'Unassigned';
                            const ticketId = formatTicketId(ticket);
                            const dueLabel = formatSlaBadge(ticket);
                            const priority = ticket.priority ?? 'P3';
                            const showPriorityChip = priority === 'P1' || priority === 'P2';
                            return (
                              <button
                                key={ticket.id}
                                type="button"
                                onClick={() => navigate(`/tickets/${ticket.id}`)}
                                className={`${rowGridClass} group w-full px-3 py-1.5 text-left transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70`}
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold leading-snug text-foreground">{ticket.subject}</div>
                                  <div className="mt-0.5 font-mono text-[12px] font-semibold text-slate-700">{ticketId}</div>
                                  <div className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">
                                    {activitySummary(ticket)}
                                  </div>
                                </div>
                                <div className="min-w-0 text-[11px] text-muted-foreground md:border-l md:border-border/60 md:pl-4">
                                  <div className="truncate text-[11px] text-slate-600">
                                    <span className="text-slate-500">Assignee:</span>{' '}
                                    <span className="font-semibold text-slate-700">
                                      {ticket.assignee?.displayName ?? ticket.assignee?.email ?? 'Unassigned'}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    {showPriorityChip ? (
                                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${priorityBadgeStyle(priority)}`}>
                                        {priority}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-500">Priority: {priority}</span>
                                    )}
                                    {dueLabel && (
                                      dueLabel.asChip ? (
                                        <span
                                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${dueLabel.className}`}
                                        >
                                          {dueLabel.label}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-slate-500">{dueLabel.label}</span>
                                      )
                                    )}
                                  </div>
                                </div>
                                <div className="min-w-0 text-[11px] text-slate-600 md:border-l md:border-border/60 md:pl-4">
                                  <div className="truncate text-[12px] font-semibold text-slate-700">{departmentLabel}</div>
                                </div>
                                <div className="flex min-w-0 items-start md:border-l md:border-border/60 md:pl-4">
                                  <StatusBadge status={ticket.status} />
                                </div>
                                <div className="flex items-start md:border-l md:border-border/60 md:pl-4">
                                  <span className="text-[11px] font-semibold text-slate-700">
                                    <RelativeTime value={ticket.updatedAt} variant="compact" />
                                  </span>
                                </div>
                                <div className="flex items-start md:border-l md:border-border/60 md:pl-4">
                                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                    <RelativeTime value={ticket.createdAt} variant="compact" />
                                    <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/tickets')}
                    className="mt-4 inline-flex items-center gap-2 text-left text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    {isEmployee ? 'View my tickets' : 'View all tickets'}
                  </button>
                </div>
              </div>
              {!isEmployee && (
                <div className="lg:col-span-2 p-6 bg-card/50">
                  <div className="flex h-full flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold leading-tight text-foreground">Ticket Activity</h2>
                      <span className="text-[13px] text-muted-foreground" title="Controlled by Updated in selector">
                        {activityRangeLabel}
                      </span>
                    </div>

                    {loadingDashboard ? (
                      <div className="h-48 w-full rounded-xl bg-muted/60 animate-pulse" />
                    ) : (
                      <TicketActivityChart data={activitySeries} />
                    )}

                    <div className="mb-4 mt-4 flex items-center gap-6 px-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-progress))]" />
                        <span className="text-sm text-muted-foreground">Open</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-resolved))]" />
                        <span className="text-sm text-muted-foreground">Resolved</span>
                      </div>
                    </div>

                    {loadingDashboard && (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={`mini-skeleton-${index}`}
                            className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-2.5 shadow-card animate-pulse"
                          >
                            <div className="h-8 w-8 rounded-full bg-muted" />
                            <div className="flex-1">
                              <div className="h-3 w-24 rounded bg-muted/70" />
                            </div>
                            <div className="h-3 w-10 rounded bg-muted/60" />
                          </div>
                        ))}
                      </div>
                    )}

                    {!loadingDashboard && miniActivityTickets.length === 0 && (
                      <p className="text-sm text-muted-foreground">No ticket activity yet.</p>
                    )}

                    {!loadingDashboard && miniActivityTickets.length > 0 && (
                      <div className="space-y-2">
                        {miniActivityTickets.map((ticket, index) => {
                          const teamLabel = ticket.assignedTeam?.name ?? 'Unassigned';
                          const ticketId = formatTicketId(ticket);
                          return (
                            <button
                              key={`mini-${ticket.id}`}
                              type="button"
                              onClick={() => navigate(`/tickets/${ticket.id}`)}
                              className="flex w-full items-start gap-3 rounded-lg border border-border bg-card/50 px-2.5 py-2 text-left transition-colors hover:bg-card animate-fade-in"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold leading-snug text-foreground">
                                  <span className="mr-2 font-mono text-[11px] font-semibold text-slate-600">{ticketId}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="ml-2">{ticket.subject}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${priorityBadgeStyle(ticket.priority)}`}>
                                    {ticket.priority ?? 'P3'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-slate-500">
                                    <span className="truncate">{teamLabel}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <StatusBadge status={ticket.status} />
                                <RelativeTime value={ticket.updatedAt} variant="compact" className="text-[11px] text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
