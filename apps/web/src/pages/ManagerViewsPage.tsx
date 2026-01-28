import { useEffect, useMemo, useState } from 'react';
import { fetchTickets, type TeamRef } from '../api/client';
import { formatStatus, statusBadgeClass } from '../utils/format';

type MetricSnapshot = {
  total: number;
  open: number;
  resolved: number;
  priorities: Record<string, number>;
  teams: { team: TeamRef; total: number }[];
};

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

export function ManagerViewsPage({
  refreshKey,
  teamsList
}: {
  refreshKey: number;
  teamsList: TeamRef[];
}) {
  const [metrics, setMetrics] = useState<MetricSnapshot>({
    total: 0,
    open: 0,
    resolved: 0,
    priorities: { P1: 0, P2: 0, P3: 0, P4: 0 },
    teams: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTeams = teamsList.length > 0;
  const isEmpty = !loading && metrics.total === 0;

  useEffect(() => {
    loadMetrics();
  }, [refreshKey, teamsList]);

  async function fetchCount(params: Record<string, string | number | undefined>) {
    const response = await fetchTickets({
      pageSize: 1,
      ...params
    });
    return response.meta.total;
  }

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    try {
      const totalPromise = fetchCount({});
      const openPromise = fetchCount({ statusGroup: 'open' });
      const resolvedPromise = fetchCount({ statusGroup: 'resolved' });
      const priorityPromises = PRIORITIES.map((priority) => fetchCount({ priority }));
      const teamPromises = teamsList.map((team) => fetchCount({ teamId: team.id }));

      const [total, open, resolved, ...rest] = await Promise.all([
        totalPromise,
        openPromise,
        resolvedPromise,
        ...priorityPromises,
        ...teamPromises
      ]);

      const priorityCounts: Record<string, number> = {};
      PRIORITIES.forEach((priority, index) => {
        priorityCounts[priority] = rest[index] ?? 0;
      });

      const teamCounts = teamsList.map((team, index) => ({
        team,
        total: rest[PRIORITIES.length + index] ?? 0
      }));

      setMetrics({
        total,
        open,
        resolved,
        priorities: priorityCounts,
        teams: teamCounts
      });
    } catch (err) {
      setError('Unable to load manager metrics.');
    } finally {
      setLoading(false);
    }
  }

  const topTeams = useMemo(() => {
    return [...metrics.teams].sort((a, b) => b.total - a.total);
  }, [metrics.teams]);

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Manager views</h3>
            <p className="text-sm text-slate-500">Snapshot of ticket volume and workload.</p>
          </div>
          <button
            type="button"
            onClick={loadMetrics}
            className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
            disabled={loading}
          >
            Refresh metrics
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {!loading && !error && (!hasTeams || isEmpty) && (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-slate-900">
            {hasTeams ? 'No tickets yet' : 'No teams available yet'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {hasTeams
              ? 'Once tickets are created, metrics will appear here.'
              : 'Add departments to start tracking workload and metrics.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {['Total tickets', 'Open tickets', 'Resolved tickets'].map((label, index) => {
          const value = index === 0 ? metrics.total : index === 1 ? metrics.open : metrics.resolved;
          const statusKey = index === 1 ? 'NEW' : index === 2 ? 'RESOLVED' : undefined;
          return (
            <div key={label} className="glass-card p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <div className="mt-3 flex items-center justify-between">
                {loading ? (
                  <div className="h-8 w-20 rounded-full skeleton-shimmer" />
                ) : (
                  <span className="text-3xl font-semibold text-slate-900">{value}</span>
                )}
                {statusKey && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(statusKey)}`}
                  >
                    {formatStatus(statusKey)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card p-6">
          <h4 className="text-sm font-semibold text-slate-900">Priority mix</h4>
          <p className="text-xs text-slate-500">Ticket volume by priority.</p>
          <div className="mt-4 space-y-3">
            {PRIORITIES.map((priority) => (
              <div key={priority} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{priority}</span>
                {loading ? (
                  <div className="h-4 w-10 rounded-full skeleton-shimmer" />
                ) : (
                  <span className="text-sm text-slate-900">{metrics.priorities[priority]}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h4 className="text-sm font-semibold text-slate-900">Team workload</h4>
          <p className="text-xs text-slate-500">Tickets per department.</p>
          <div className="mt-4 space-y-3">
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`team-skeleton-${index}`} className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded-full skeleton-shimmer" />
                    <div className="h-4 w-10 rounded-full skeleton-shimmer" />
                  </div>
                ))}
              </div>
            )}
            {!loading && topTeams.length === 0 && (
              <p className="text-sm text-slate-500">No teams available yet.</p>
            )}
            {!loading &&
              topTeams.map(({ team, total }) => (
                <div key={team.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{team.name}</span>
                  <span className="text-sm font-semibold text-slate-900">{total}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
