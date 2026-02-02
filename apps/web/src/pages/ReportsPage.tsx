import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  ApiError,
  fetchCategories,
  fetchReportAgentPerformance,
  fetchReportResolutionTime,
  fetchReportSlaCompliance,
  fetchReportTicketVolume,
  fetchReportTicketsByPriority,
  fetchReportTicketsByStatus,
  fetchTeams,
  type ReportQuery,
  type TeamRef,
} from '../api/client';
import {
  AgentScorecard,
} from '../components/reports/AgentScorecard';
import {
  ReportFilters,
  getDefaultReportFilters,
  reportFiltersToQuery,
  type ReportFiltersState,
} from '../components/reports/ReportFilters';
import { ResolutionTimeChart } from '../components/reports/ResolutionTimeChart';
import { SlaComplianceChart } from '../components/reports/SlaComplianceChart';
import { TicketVolumeChart } from '../components/reports/TicketVolumeChart';
import { TicketsByPriorityChart } from '../components/reports/TicketsByPriorityChart';
import { TicketsByStatusChart } from '../components/reports/TicketsByStatusChart';
import type { CategoryRef } from '../api/client';

export function ReportsPage() {
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [filters, setFilters] = useState<ReportFiltersState>(getDefaultReportFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [volume, setVolume] = useState<{ date: string; count: number }[]>([]);
  const [sla, setSla] = useState<{ met: number; breached: number; total: number }>({
    met: 0,
    breached: 0,
    total: 0,
  });
  const [resolutionTime, setResolutionTime] = useState<
    { label: string; avgHours: number; count: number }[]
  >([]);
  const [byPriority, setByPriority] = useState<{ priority: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [agents, setAgents] = useState<
    {
      userId: string;
      name: string;
      email: string;
      ticketsResolved: number;
      avgResolutionHours: number | null;
      firstResponses: number;
      avgFirstResponseHours: number | null;
    }[]
  >([]);

  useEffect(() => {
    Promise.all([
      fetchTeams().then((r) => setTeams(r.data)),
      fetchCategories({ includeInactive: false }).then((r) => setCategories(r.data)),
    ]).catch(() => setError('Failed to load teams/categories'));
  }, []);

  const query = reportFiltersToQuery(filters);
  const reportQuery: ReportQuery = {
    ...query,
    groupBy: 'team',
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [volRes, slaRes, resRes, priRes, statusRes, agentRes] = await Promise.all([
        fetchReportTicketVolume(reportQuery),
        fetchReportSlaCompliance(reportQuery),
        fetchReportResolutionTime({ ...reportQuery, groupBy: 'team' }),
        fetchReportTicketsByPriority(reportQuery),
        fetchReportTicketsByStatus(reportQuery),
        fetchReportAgentPerformance(reportQuery),
      ]);
      setVolume(volRes.data);
      setSla(slaRes.data);
      setResolutionTime(resRes.data);
      setByPriority(priRes.data);
      setByStatus(statusRes.data);
      setAgents(agentRes.data);
    } catch (e) {
      const message = e instanceof ApiError
        ? `Reports failed (${e.status}): ${e.message || 'Check API is running and you are logged in as Admin.'}`
        : e instanceof Error
          ? e.message
          : 'Failed to load reports';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.teamId, filters.priority, filters.categoryId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  function exportCsv() {
    const headers = [
      'Agent',
      'Email',
      'Tickets Resolved',
      'Avg Resolution (h)',
      'First Responses',
      'Avg First Response (h)',
    ];
    const rows = agents.map((a) => [
      a.name || a.email,
      a.email,
      a.ticketsResolved,
      a.avgResolutionHours ?? '',
      a.firstResponses,
      a.avgFirstResponseHours ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateLabel = filters.from && filters.to
      ? `${filters.from}-${filters.to}`
      : 'all-time';
    link.download = `agent-scorecard-${dateLabel}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Reports Dashboard</h3>
            <p className="text-sm text-slate-500 mt-1">
              Ticket volume, SLA compliance, resolution time, and agent performance.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
        <div className="mt-4">
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            teams={teams}
            categories={categories}
          />
        </div>
      </div>

      {error && (
        <div className="glass-card p-6 border-red-200 bg-red-50/50">
          <p className="text-sm font-medium text-red-700">Reports error</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            Ensure the API is running (e.g. port 3000 or VITE_API_BASE_URL) and you are signed in as Admin.
          </p>
        </div>
      )}
      {loading && (
        <div className="glass-card p-6">
          <p className="text-sm text-slate-500">Loading reports…</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {volume.length === 0 && byPriority.length === 0 && byStatus.length === 0 && agents.length === 0 && (
            <div className="glass-card p-6 border-slate-200 bg-slate-50/50">
              <p className="text-sm text-slate-600">
                No ticket data for the selected period. Try a wider date range or different filters.
              </p>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Ticket Volume</h4>
              <TicketVolumeChart data={volume} />
            </div>
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">SLA Compliance</h4>
              <SlaComplianceChart data={sla} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">
                Avg Resolution Time (by team)
              </h4>
              <ResolutionTimeChart data={resolutionTime} />
            </div>
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Tickets by Priority</h4>
              <TicketsByPriorityChart data={byPriority} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Tickets by Status</h4>
              <TicketsByStatusChart data={byStatus} />
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Agent Performance Scorecard</h4>
            <AgentScorecard data={agents} />
          </div>
        </>
      )}
    </section>
  );
}
