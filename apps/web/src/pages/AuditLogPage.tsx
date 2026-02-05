import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  fetchAuditLog,
  fetchAuditLogExport,
  fetchUsers,
  type AuditLogEntry,
  type UserRef,
} from '../api/client';
import { AuditLogTable } from '../components/AuditLogTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

const EVENT_TYPES = [
  { value: '', label: 'All types' },
  { value: 'TICKET_CREATED', label: 'Created ticket' },
  { value: 'TICKET_ASSIGNED', label: 'Assigned' },
  { value: 'TICKET_TRANSFERRED', label: 'Transferred' },
  { value: 'TICKET_STATUS_CHANGED', label: 'Status changed' },
  { value: 'TICKET_PRIORITY_CHANGED', label: 'Priority changed' },
  { value: 'MESSAGE_ADDED', label: 'Message added' },
  { value: 'ATTACHMENT_ADDED', label: 'Attachment added' },
];

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function AuditLogPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [users, setUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUsers()
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  const loadLog = useCallback(
    async (overridePage?: number) => {
      setLoading(true);
      setError(null);
      const p = overridePage ?? page;
      try {
        const res = await fetchAuditLog({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          userId: userId || undefined,
          type: type || undefined,
          search: search.trim() || undefined,
          page: p,
          pageSize: 20,
        });
        setData(res.data);
        setMeta(res.meta);
        if (overridePage !== undefined) setPage(overridePage);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load audit log.');
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, userId, type, search, page],
  );

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const csv = await fetchAuditLogExport({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: userId || undefined,
        type: type || undefined,
        search: search.trim() || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-log-${dateFrom || 'all'}-${dateTo || 'all'}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  const today = toDateOnly(new Date().toISOString());

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ticket changes and actions for compliance and troubleshooting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date from</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={today}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date to</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              max={today}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">User</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Action type</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value || 'all'} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Ticket #, ID, or user name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLog(1)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadLog(1)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Apply filters
          </button>
          {(dateFrom || dateTo || userId || type || search.trim()) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setUserId('');
                setType('');
                setSearch('');
                setPage(1);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && !loading && (
          <div className="mt-6">
            <ErrorState
              title="Unable to load audit log"
              description={error}
              onRetry={() => loadLog(1)}
              secondaryAction={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard') }}
            />
          </div>
        )}

        {loading ? (
          <div className="mt-6 h-48 rounded-lg border border-border bg-muted/30 animate-pulse" />
        ) : error ? null : (
          <>
            {data.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="No audit events"
                  description="No events match the current filters. Try adjusting filters or clear them to see all activity."
                  secondaryAction={
                    dateFrom || dateTo || userId || type || search.trim()
                      ? {
                          label: 'Clear filters',
                          onClick: () => {
                            setDateFrom('');
                            setDateTo('');
                            setUserId('');
                            setType('');
                            setSearch('');
                            setPage(1);
                          },
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="mt-6">
                <AuditLogTable data={data} />
              </div>
            )}
            {data.length > 0 && meta.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.totalPages} ({meta.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={meta.page <= 1}
                    className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={meta.page >= meta.totalPages}
                    className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
