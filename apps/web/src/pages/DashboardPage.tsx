import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, type TicketRecord } from '../api/client';
import type { DashboardStats } from '../types';
import { formatDate, formatStatus } from '../utils/format';

export function DashboardPage({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const [recentTickets, setRecentTickets] = useState<TicketRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ open: 0, resolved: 0, total: 0 });
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [refreshKey]);

  async function loadDashboard() {
    setLoadingDashboard(true);
    try {
      const [recentResponse, openResponse, resolvedResponse] = await Promise.all([
        fetchTickets({ pageSize: 6, sort: 'updatedAt', order: 'desc' }),
        fetchTickets({ pageSize: 1, statusGroup: 'open' }),
        fetchTickets({ pageSize: 1, statusGroup: 'resolved' })
      ]);

      setRecentTickets(recentResponse.data);
      const openCount = openResponse.meta.total;
      const resolvedCount = resolvedResponse.meta.total;
      setDashboardStats({
        open: openCount,
        resolved: resolvedCount,
        total: openCount + resolvedCount
      });
    } catch (error) {
      setRecentTickets([]);
      setDashboardStats({ open: 0, resolved: 0, total: 0 });
    } finally {
      setLoadingDashboard(false);
    }
  }

  return (
    <section className="mt-8 space-y-8 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadingDashboard
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-skeleton-${index}`} className="glass-card p-5 animate-pulse">
                <div className="h-3 w-28 rounded-full bg-slate-200" />
                <div className="mt-4 h-8 w-16 rounded-full bg-slate-200" />
              </div>
            ))
          : (
            <>
              <div className="glass-card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Open tickets</p>
                <p className="text-3xl font-semibold text-slate-900 mt-2">{dashboardStats.open}</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Resolved & closed</p>
                <p className="text-3xl font-semibold text-slate-900 mt-2">{dashboardStats.resolved}</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Total requests</p>
                <p className="text-3xl font-semibold text-slate-900 mt-2">{dashboardStats.total}</p>
              </div>
            </>
          )}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Recent activity</h3>
            <p className="text-sm text-slate-600">Latest updates across your tickets.</p>
          </div>
        </div>
        {loadingDashboard && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`recent-skeleton-${index}`}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 animate-pulse"
              >
                <div className="h-3 w-40 rounded-full bg-slate-200" />
                <div className="mt-2 h-3 w-24 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        )}
        {!loadingDashboard && recentTickets.length === 0 && (
          <p className="text-sm text-slate-600">No recent tickets yet.</p>
        )}
        <div className="space-y-3">
          {recentTickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              className="w-full flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{ticket.subject}</p>
                <p className="text-xs text-slate-600">
                  {ticket.assignedTeam?.name ?? 'Unassigned'} · {formatStatus(ticket.status)}
                </p>
              </div>
              <span className="text-xs text-slate-500">{formatDate(ticket.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
