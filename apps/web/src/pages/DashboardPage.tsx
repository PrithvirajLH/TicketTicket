import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Eye, Ticket as TicketIcon, UserCheck, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchReportAgentPerformance,
  fetchReportAgentWorkload,
  fetchReportTicketVolume,
  fetchReportReopenRate,
  fetchReportResolutionTime,
  fetchReportTicketsByAge,
  fetchReportTicketsByCategory,
  fetchReportTeamSummary,
  fetchReportTransfers,
  fetchReportTicketsByPriority,
  fetchReportSlaCompliance,
  fetchTicketActivity,
  fetchTicketStatusBreakdown,
  fetchTickets,
  type AgentPerformanceResponse,
  type AgentWorkloadResponse,
  type TeamSummaryResponse,
  type TransfersResponse,
  type NotificationRecord,
  type ReopenRateResponse,
  type ResolutionTimeResponse,
  type TicketActivityPoint,
  type TicketRecord,
  type TicketStatusPoint,
  type TicketsByCategoryResponse,
  type TicketsByPriorityResponse,
  type TicketAgeBucketResponse
} from '../api/client';
import { EmptyState } from '../components/EmptyState';
import { RelativeTime } from '../components/RelativeTime';
import { TopBar } from '../components/TopBar';
import { KPICard } from '../components/dashboard/KPICard';
import { KPICardSkeleton } from '../components/skeletons';
import { StatusBadge } from '../components/dashboard/StatusBadge';
import { TicketActivityChart, type ActivityPoint } from '../components/dashboard/TicketActivityChart';
import { AgentScorecard } from '../components/reports/AgentScorecard';
import { AgentWorkloadChart } from '../components/reports/AgentWorkloadChart';
import { ReopenRateChart } from '../components/reports/ReopenRateChart';
import { TransfersChart } from '../components/reports/TransfersChart';
import { ResolutionTimeChart } from '../components/reports/ResolutionTimeChart';
import { SlaComplianceChart } from '../components/reports/SlaComplianceChart';
import { TicketsByStatusChart } from '../components/reports/TicketsByStatusChart';
import { TicketsByAgeChart } from '../components/reports/TicketsByAgeChart';
import { TicketsByPriorityChart } from '../components/reports/TicketsByPriorityChart';
import { TeamSummaryTable } from '../components/reports/TeamSummaryTable';
import { TicketVolumeChart } from '../components/reports/TicketVolumeChart';
import { formatStatus, formatTicketId } from '../utils/format';
import type { DashboardStats, Role } from '../types';

const RECENT_TICKETS_COUNT = 6;
function mapActivitySeries(data: TicketActivityPoint[], rangeDays: number): ActivityPoint[] {
  return data.map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`);
    const day =
      rangeDays > 7
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return { ...point, day };
  });
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
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    open: 0,
    resolved: 0,
    total: 0,
    unassigned: 0,
    assignedToMe: 0,
    resolvedByMe: 0,
  });
  const [activitySeries, setActivitySeries] = useState<ActivityPoint[]>([]);
  const [ticketsByStatus, setTicketsByStatus] = useState<TicketStatusPoint[]>([]);
  const [ticketsByPriority, setTicketsByPriority] = useState<TicketsByPriorityResponse['data']>([]);
  const [ticketsByAge, setTicketsByAge] = useState<TicketAgeBucketResponse['data']>([]);
  const [agentWorkload, setAgentWorkload] = useState<AgentWorkloadResponse['data']>([]);
  const [reopenSeries, setReopenSeries] = useState<ReopenRateResponse['data']>([]);
  const [queueCategories, setQueueCategories] = useState<TicketsByCategoryResponse['data']>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummaryResponse['data']>([]);
  const [ticketVolume, setTicketVolume] = useState<{ date: string; count: number }[]>([]);
  const [transferSeries, setTransferSeries] = useState<TransfersResponse['data']['series']>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [slaCompliance, setSlaCompliance] = useState<{ met: number; breached: number; total: number }>({
    met: 0,
    breached: 0,
    total: 0,
  });
  const [resolutionTime, setResolutionTime] = useState<ResolutionTimeResponse['data']>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceResponse['data']>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const isEmployee = role === 'EMPLOYEE';
  const isAgent = role === 'AGENT';
  const isLead = role === 'LEAD';
  const isTeamAdmin = role === 'TEAM_ADMIN';
  const isOwner = role === 'OWNER';
  const [activityRange, setActivityRange] = useState<'3' | '7' | '30'>(isEmployee ? '3' : '7');
  const [onlyMyTickets, setOnlyMyTickets] = useState(false);
  const [activitySort, setActivitySort] = useState<'recent' | 'oldest'>('recent');
  const [slaQueueStats, setSlaQueueStats] = useState({ atRisk: 0, overdue: 0 });
  const [exceptionRange, setExceptionRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    if (isEmployee) {
      setActivityRange('3');
      setOnlyMyTickets(false);
      setActivitySort('recent');
    }
    if (isAgent) {
      setOnlyMyTickets(true);
      setActivitySort('recent');
    }
    if (isLead || isTeamAdmin || isOwner) {
      setOnlyMyTickets(false);
      setActivitySort('recent');
    }
  }, [isEmployee, isAgent, isLead, isTeamAdmin, isOwner]);

  useEffect(() => {
    let isActive = true;
    const emptyTicketResponse = {
      data: [] as TicketRecord[],
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
    };

    const loadDashboard = async () => {
      if (!hasLoadedOnceRef.current) {
        setLoadingDashboard(true);
      } else {
        setRefreshingDashboard(true);
      }
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
            unassigned: 0,
            assignedToMe: 0,
            resolvedByMe: 0,
          });
          setActivitySeries([]);
          setTicketsByStatus([]);
          setTicketsByPriority([]);
          setTicketsByAge([]);
          setSlaCompliance({ met: 0, breached: 0, total: 0 });
          setResolutionTime([]);
          setAgentPerformance([]);
          setAgentWorkload([]);
          setReopenSeries([]);
          setQueueCategories([]);
          setTeamSummary([]);
          setTicketVolume([]);
          setTransferSeries([]);
          setTransferTotal(0);
          setSlaQueueStats({ atRisk: 0, overdue: 0 });
        } else {
          const rangeDays = Number(activityRange);
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - rangeDays);
          const updatedFrom = fromDate.toISOString();
          const toDate = new Date();
          const updatedTo = toDate.toISOString().slice(0, 10);
          const activityFrom = fromDate.toISOString().slice(0, 10);
          const activityTo = toDate.toISOString().slice(0, 10);
          const scope = isAgent ? 'assigned' : isLead || isTeamAdmin || isOwner ? undefined : onlyMyTickets ? 'assigned' : undefined;
          const order = activitySort === 'oldest' ? 'asc' : 'desc';

          const [
            recentResponse,
            openResponse,
            resolvedResponse,
            unassignedResponse,
            assignedToMeResponse,
            resolvedByMeResponse,
            atRiskResponse,
            overdueResponse,
            activityResponse,
            statusResponse,
            slaResponse,
            agentResponse,
            workloadResponse,
            priorityResponse,
            resolutionResponse,
            ageResponse,
            reopenResponse,
            categoryResponse,
            teamSummaryResponse,
            volumeResponse,
            transfersResponse
          ] = await Promise.all([
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
              updatedTo,
              ...(scope ? { scope } : {}),
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'resolved',
              updatedFrom,
              updatedTo,
              ...(scope ? { scope } : {}),
            }).catch(() => emptyTicketResponse),
            scope === 'assigned'
              ? Promise.resolve(emptyTicketResponse)
              : fetchTickets({
                  pageSize: 1,
                  statusGroup: 'open',
                  scope: 'unassigned',
                  updatedFrom,
                  updatedTo,
                }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'open',
              scope: 'assigned',
              updatedFrom,
              updatedTo,
            }).catch(() => emptyTicketResponse),
            fetchTickets({
              pageSize: 1,
              statusGroup: 'resolved',
              scope: 'assigned',
              updatedFrom,
              updatedTo,
            }).catch(() => emptyTicketResponse),
            isTeamAdmin
              ? fetchTickets({
                  pageSize: 1,
                  slaStatus: ['at_risk'],
                  updatedFrom,
                  updatedTo,
                }).catch(() => emptyTicketResponse)
              : Promise.resolve(emptyTicketResponse),
            isTeamAdmin
              ? fetchTickets({
                  pageSize: 1,
                  slaStatus: ['breached'],
                  updatedFrom,
                  updatedTo,
                }).catch(() => emptyTicketResponse)
              : Promise.resolve(emptyTicketResponse),
            fetchTicketActivity({
              from: activityFrom,
              to: activityTo,
              ...(scope ? { scope } : {}),
            }).catch(() => ({ data: [] })),
            fetchTicketStatusBreakdown({
              from: activityFrom,
              to: activityTo,
              ...(isAgent ? { scope: 'assigned' } : {}),
              dateField: 'updatedAt',
            }).catch(() => ({ data: [] })),
            isLead || isTeamAdmin
              ? fetchReportSlaCompliance({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: { met: 0, breached: 0, total: 0 } }))
              : Promise.resolve({ data: { met: 0, breached: 0, total: 0 } }),
            isLead || isOwner
              ? fetchReportAgentPerformance({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isLead || isTeamAdmin
              ? fetchReportAgentWorkload({})
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isTeamAdmin
              ? fetchReportTicketsByPriority({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isTeamAdmin
              ? fetchReportResolutionTime({ from: activityFrom, to: activityTo, groupBy: 'priority', dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isTeamAdmin
              ? fetchReportTicketsByAge({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isTeamAdmin || isOwner
              ? fetchReportReopenRate({ from: activityFrom, to: activityTo })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isTeamAdmin
              ? fetchReportTicketsByCategory({ from: activityFrom, to: activityTo, statusGroup: 'open', dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isOwner
              ? fetchReportTeamSummary({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isOwner
              ? fetchReportTicketVolume({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            isOwner
              ? fetchReportTransfers({ from: activityFrom, to: activityTo, dateField: 'updatedAt' })
                  .catch(() => ({ data: { total: 0, series: [] } }))
              : Promise.resolve({ data: { total: 0, series: [] } }),
          ]);

          if (!isActive) return;

          setRecentTickets(recentResponse.data);
          const openCount = openResponse.meta.total;
          const resolvedCount = resolvedResponse.meta.total;
          setDashboardStats({
            open: openCount,
            resolved: resolvedCount,
            total: openCount + resolvedCount,
            unassigned: unassignedResponse.meta.total,
            assignedToMe: assignedToMeResponse.meta.total,
            resolvedByMe: resolvedByMeResponse.meta.total,
          });
          setActivitySeries(mapActivitySeries(activityResponse.data, rangeDays));
          setTicketsByStatus(statusResponse.data);
          setTicketsByPriority(priorityResponse.data);
          setTicketsByAge(ageResponse.data);
          setSlaCompliance(slaResponse.data);
          setResolutionTime(resolutionResponse.data);
          setAgentPerformance(agentResponse.data);
          setAgentWorkload(workloadResponse.data);
          setReopenSeries(reopenResponse.data);
          setQueueCategories(categoryResponse.data.slice(0, 6));
          setTeamSummary(teamSummaryResponse.data);
          setTicketVolume(volumeResponse.data);
          setTransferSeries(transfersResponse.data.series);
          setTransferTotal(transfersResponse.data.total);
          setSlaQueueStats({
            atRisk: atRiskResponse.meta.total,
            overdue: overdueResponse.meta.total,
          });
        }
      } catch (error) {
        if (!isActive) return;
        setRecentTickets([]);
        setDashboardStats({
          open: 0,
          resolved: 0,
          total: 0,
          unassigned: 0,
          assignedToMe: 0,
          resolvedByMe: 0,
        });
        setActivitySeries([]);
        setTicketsByStatus([]);
        setTicketsByPriority([]);
        setTicketsByAge([]);
        setSlaCompliance({ met: 0, breached: 0, total: 0 });
        setResolutionTime([]);
        setAgentPerformance([]);
        setAgentWorkload([]);
        setReopenSeries([]);
        setQueueCategories([]);
        setTeamSummary([]);
        setTicketVolume([]);
        setTransferSeries([]);
        setTransferTotal(0);
        setSlaQueueStats({ atRisk: 0, overdue: 0 });
      } finally {
        if (isActive) {
          setLoadingDashboard(false);
          setRefreshingDashboard(false);
          hasLoadedOnceRef.current = true;
        }
      }
    };

    loadDashboard();
    return () => {
      isActive = false;
    };
  }, [refreshKey, isEmployee, isAgent, isLead, isTeamAdmin, activityRange, onlyMyTickets, activitySort]);

  const activityRangeLabel =
    activityRange === '3' ? 'Last 3 days' : activityRange === '7' ? 'Last 7 days' : 'Last 30 days';
  const rowGridClass =
    'grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.55fr)_minmax(0,0.3fr)_minmax(0,0.35fr)] items-start gap-3 md:gap-4';
  const unassignedPercent = dashboardStats.open
    ? Math.round(((dashboardStats.unassigned ?? 0) / dashboardStats.open) * 100)
    : 0;
  const activeAgents = isOwner
    ? agentPerformance.length
    : agentWorkload.filter((row) => row.assignedOpen > 0).length;
  const reopenTotal = reopenSeries.reduce((sum, row) => sum + row.count, 0);
  const reopenRatePercent = dashboardStats.total
    ? Math.round((reopenTotal / dashboardStats.total) * 100)
    : 0;

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
              {refreshingDashboard && (
                <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                  Refreshing…
                </p>
              )}
            </div>
          )}
          <div className={`grid gap-4 ${isEmployee ? 'sm:grid-cols-2' : isTeamAdmin || isOwner ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-2 xl:grid-cols-4'} ${headerProps ? 'mt-6' : ''} mb-6`}>
            {loadingDashboard
              ? Array.from({ length: isEmployee ? 2 : isTeamAdmin || isOwner ? 5 : 4 }).map((_, index) => (
                  <KPICardSkeleton key={`stat-skeleton-${index}`} />
                ))
              : (
                <>
                  {isEmployee ? (
                    <>
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.open}
                        label="My open tickets"
                        variant="blue"
                      />
                      <KPICard
                        icon={CheckCircle2}
                        value={dashboardStats.resolved}
                        label="My resolved & closed tickets"
                        variant="green"
                      />
                    </>
                  ) : isTeamAdmin ? (
                    <>
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.open}
                        label="Open tickets"
                        variant="blue"
                      />
                      <KPICard
                        icon={Clock}
                        value={slaQueueStats.atRisk}
                        label="At risk"
                        variant="default"
                        helper="Near breach window"
                      />
                      <KPICard
                        icon={Clock}
                        value={slaQueueStats.overdue}
                        label="Overdue"
                        variant="blue"
                        helper="Breached SLA"
                      />
                      <KPICard
                        icon={UserCheck}
                        value={activeAgents}
                        label="Active agents"
                        variant="default"
                        helper={`${unassignedPercent}% unassigned`}
                      />
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.total}
                        label="Total requests"
                        variant="green"
                      />
                    </>
                  ) : isOwner ? (
                    <>
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.open}
                        label="Open tickets"
                        variant="blue"
                      />
                      <KPICard
                        icon={CheckCircle2}
                        value={dashboardStats.resolved}
                        label="Closed tickets"
                        variant="green"
                      />
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.total}
                        label="Total requests"
                        variant="default"
                      />
                      <KPICard
                        icon={UserCheck}
                        value={activeAgents}
                        label="Active agents"
                        variant="blue"
                      />
                      <KPICard
                        icon={Clock}
                        value={transferTotal}
                        label="Transfers"
                        variant="default"
                      />
                    </>
                  ) : (
                    <>
                      <KPICard
                        icon={TicketIcon}
                        value={dashboardStats.open}
                        label="Total open tickets"
                        variant="blue"
                      />
                      <KPICard
                        icon={UserMinus}
                        value={dashboardStats.unassigned ?? 0}
                        label="Unassigned tickets"
                        variant="default"
                      />
                      <KPICard
                        icon={UserCheck}
                        value={dashboardStats.assignedToMe ?? 0}
                        label="Assigned to me"
                        variant="blue"
                      />
                      <KPICard
                        icon={CheckCircle2}
                        value={dashboardStats.resolvedByMe ?? 0}
                        label="Resolved by me"
                        variant="green"
                      />
                    </>
                  )}
                </>
              )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-visible">
            {isTeamAdmin ? (
              <div className="p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold leading-tight text-foreground">Queue operations</h2>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      Ops metrics and queue signals for your team.
                    </p>
                  </div>
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
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-4">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Queues</h3>
                        <span className="text-[11px] text-muted-foreground">Open now</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-border/80 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            At-risk queue
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-slate-900">
                            {slaQueueStats.atRisk}
                          </div>
                          <div className="text-[11px] text-muted-foreground">Near breach window</div>
                        </div>
                        <div className="rounded-md border border-border/80 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Breached SLA
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-slate-900">
                            {slaQueueStats.overdue}
                          </div>
                          <div className="text-[11px] text-muted-foreground">Overdue tickets</div>
                        </div>
                        <div className="rounded-md border border-border/80 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Unassigned
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-slate-900">
                            {unassignedPercent}%
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {dashboardStats.unassigned ?? 0} tickets
                          </div>
                        </div>
                        <div className="rounded-md border border-border/80 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Re-open rate
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-slate-900">
                            {reopenRatePercent}%
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {reopenTotal} reopens
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 border-t border-border/70 pt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                            Queues by category
                          </h4>
                          <span className="text-[11px] text-muted-foreground">Open tickets</span>
                        </div>
                        {queueCategories.length === 0 ? (
                          <p className="text-sm text-slate-500">No queue data available.</p>
                        ) : (
                          <div className="space-y-2">
                            {queueCategories.map((queue) => (
                              <div key={queue.id} className="flex items-center justify-between rounded-md border border-border/70 bg-white px-3 py-2 text-sm">
                                <span className="font-medium text-slate-700">{queue.name}</span>
                                <span className="text-sm font-semibold text-slate-900">{queue.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-5">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Tickets by age</h3>
                        <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-foreground shadow-card">
                          <span className="text-slate-500">Range:</span>
                          <select
                            className="appearance-none bg-transparent pr-5 text-[11px] font-semibold text-foreground outline-none focus:outline-none focus:ring-0"
                            value={activityRange}
                            onChange={(event) => setActivityRange(event.target.value as '3' | '7' | '30')}
                          >
                            <option value="7">This week</option>
                            <option value="30">Last 30 days</option>
                            <option value="3">Last 3 days</option>
                          </select>
                        </label>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[220px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <TicketsByAgeChart data={ticketsByAge} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Routing exceptions</h3>
                        <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-foreground shadow-card">
                          <span className="text-slate-500">Window:</span>
                          <select
                            className="appearance-none bg-transparent pr-5 text-[11px] font-semibold text-foreground outline-none focus:outline-none focus:ring-0"
                            value={exceptionRange}
                            onChange={(event) => setExceptionRange(event.target.value as '24h' | '7d' | '30d')}
                          >
                            <option value="24h">Last 24h</option>
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                          </select>
                        </label>
                      </div>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Emails not parsed', severity: 'Incident', count: 0 },
                          { label: 'Tickets auto-assigned', severity: 'Warning', count: 0 },
                          { label: 'Failed webhooks', severity: 'Incident', count: 0 },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-md border border-border/70 bg-white px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-700">{item.label}</div>
                              <div className="text-[11px] text-muted-foreground">{item.severity}</div>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">{item.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Admin controls</h3>
                        <span className="text-[11px] text-muted-foreground">Tools & settings</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Routing rules', href: '/routing', enabled: true },
                          { label: 'Business hours', href: '', enabled: false },
                          { label: 'Macros', href: '', enabled: false },
                          { label: 'Tags', href: '', enabled: false },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => item.enabled && navigate(item.href)}
                            className={`flex w-full items-center justify-between rounded-md border border-border/70 bg-white px-3 py-2 text-left transition ${
                              item.enabled ? 'hover:bg-slate-50' : 'opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <span className="font-medium text-slate-700">{item.label}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.enabled ? 'Open' : 'Coming soon'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-3">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">SLA compliance</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[220px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <SlaComplianceChart data={{ ...slaCompliance, atRisk: slaQueueStats.atRisk }} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Reopen rate</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[220px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <ReopenRateChart data={reopenSeries} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : isOwner ? (
              <div className="p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold leading-tight text-foreground">Platform overview</h2>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      Executive view of team performance and platform health.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card">
                    <span className="text-slate-500">Updated in:</span>
                    <div className="relative">
                      <select
                        className="appearance-none bg-transparent pr-5 text-xs font-semibold text-foreground outline-none focus:outline-none focus:ring-0"
                        value={activityRange}
                        onChange={(event) => setActivityRange(event.target.value as '3' | '7' | '30')}
                      >
                        <option value="3">Last 3 days</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </label>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-4">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Team summary</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <TeamSummaryTable data={teamSummary} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Tickets by priority</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <TicketsByPriorityChart data={ticketsByPriority} />
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-5">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Platform activity</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[220px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <TicketVolumeChart data={ticketVolume} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Transfers</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <TransfersChart data={transferSeries} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Reopen rate</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <ReopenRateChart data={reopenSeries} />
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-3">
                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">SLA compliance</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[220px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <SlaComplianceChart data={{ ...slaCompliance, atRisk: slaQueueStats.atRisk }} />
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Agent performance</h3>
                        <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                      </div>
                      {loadingDashboard ? (
                        <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                      ) : (
                        <AgentScorecard data={agentPerformance} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`grid gap-0 ${isEmployee ? '' : 'lg:grid-cols-5'} divide-y lg:divide-y-0 lg:divide-x divide-border`}>
                <div className={`${isEmployee ? '' : 'lg:col-span-3'} p-6`}>
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold leading-tight text-foreground">
                        {isLead ? 'Team insights' : isTeamAdmin ? 'Queue operations' : 'Recent activity'}
                      </h2>
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {isLead
                          ? 'Operational metrics across your team.'
                          : isTeamAdmin
                            ? 'Queue health and throughput for your team.'
                            : 'Latest updates across your tickets.'}
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
                      {!isLead && !isTeamAdmin && (
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
                      )}
                      {!isEmployee && !isAgent && !isLead && !isTeamAdmin && (
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

                  {isLead && (
                    <div className="space-y-6">
                      <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Agent workload</h3>
                          <span className="text-[11px] text-muted-foreground">Open now</span>
                        </div>
                        {loadingDashboard ? (
                          <div className="h-[240px] w-full rounded-lg bg-muted/60 animate-pulse" />
                        ) : (
                          <AgentWorkloadChart data={agentWorkload} />
                        )}
                      </div>

                      <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Ticket status</h3>
                          <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                        </div>
                        {loadingDashboard ? (
                          <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                        ) : (
                          <TicketsByStatusChart data={ticketsByStatus} height={180} />
                        )}
                      </div>
                    </div>
                  )}

                  {isTeamAdmin && (
                    <div className="space-y-6">
                      <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Queue activity</h3>
                          <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                        </div>
                        {loadingDashboard ? (
                          <div className="h-48 w-full rounded-lg bg-muted/60 animate-pulse" />
                        ) : (
                          <TicketActivityChart data={activitySeries} />
                        )}
                        <div className="mt-4 flex items-center gap-6 px-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-progress))]" />
                            <span className="text-sm text-muted-foreground">Open</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-resolved))]" />
                            <span className="text-sm text-muted-foreground">Resolved</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Tickets by status</h3>
                          <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                        </div>
                        {loadingDashboard ? (
                          <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                        ) : (
                          <TicketsByStatusChart data={ticketsByStatus} height={180} />
                        )}
                      </div>

                      <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Tickets by priority</h3>
                          <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                        </div>
                        {loadingDashboard ? (
                          <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                        ) : (
                          <TicketsByPriorityChart data={ticketsByPriority} />
                        )}
                      </div>
                    </div>
                  )}

                  {!isLead && !isTeamAdmin && loadingDashboard && (
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

                  {!isLead && !isTeamAdmin && !loadingDashboard && recentTickets.length === 0 && (
                    <EmptyState
                      title={isEmployee ? 'No recent activity' : 'No recent tickets yet'}
                      description={
                        isEmployee
                          ? 'No recent activity in the last 3 days.'
                          : 'Recent tickets will appear here.'
                      }
                      compact
                    />
                  )}

                  {!isLead && !isTeamAdmin && !loadingDashboard && recentTickets.length > 0 && (
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

                  {!isLead && (
                    <button
                      type="button"
                      onClick={() => navigate('/tickets')}
                      className="mt-4 inline-flex items-center gap-2 text-left text-sm font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      {isEmployee ? 'View my tickets' : 'View all tickets'}
                    </button>
                  )}
                </div>
              </div>
              {!isEmployee && (
                <div className="lg:col-span-2 p-6 bg-card/50">
                  <div className="flex h-full flex-col">
                    {isLead ? (
                      <div className="space-y-6">
                        <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">SLA performance</h3>
                            <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                          </div>
                          {loadingDashboard ? (
                            <div className="h-[240px] w-full rounded-lg bg-muted/60 animate-pulse" />
                          ) : (
                            <SlaComplianceChart data={{ ...slaCompliance, atRisk: slaQueueStats.atRisk }} />
                          )}
                        </div>

                        <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Agent performance</h3>
                            <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                          </div>
                          {loadingDashboard ? (
                            <div className="h-[200px] w-full rounded-lg bg-muted/60 animate-pulse" />
                          ) : (
                            <AgentScorecard data={agentPerformance} />
                          )}
                        </div>
                      </div>
                    ) : isTeamAdmin ? (
                      <div className="space-y-6">
                        <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">SLA performance</h3>
                            <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                          </div>
                          {loadingDashboard ? (
                            <div className="h-[240px] w-full rounded-lg bg-muted/60 animate-pulse" />
                          ) : (
                            <SlaComplianceChart data={{ ...slaCompliance, atRisk: slaQueueStats.atRisk }} />
                          )}
                        </div>

                        <div className="rounded-lg border border-border/70 bg-white p-4 shadow-card">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Resolution time by priority</h3>
                            <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                          </div>
                          {loadingDashboard ? (
                            <div className="h-[240px] w-full rounded-lg bg-muted/60 animate-pulse" />
                          ) : (
                            <ResolutionTimeChart data={resolutionTime} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
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

                        <div className="mb-6 mt-4 flex items-center gap-6 px-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-progress))]" />
                            <span className="text-sm text-muted-foreground">Open</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-resolved))]" />
                            <span className="text-sm text-muted-foreground">Resolved</span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold leading-tight text-foreground">Tickets by status</h3>
                            <span className="text-[11px] text-muted-foreground">{activityRangeLabel}</span>
                          </div>
                          {loadingDashboard ? (
                            <div className="h-[200px] w-full rounded-xl bg-muted/60 animate-pulse" />
                          ) : (
                            <TicketsByStatusChart data={ticketsByStatus} />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
