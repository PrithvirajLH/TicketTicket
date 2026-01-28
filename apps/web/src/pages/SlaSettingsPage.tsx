import { useEffect, useMemo, useState } from 'react';
import { fetchSlaPolicies, resetSlaPolicies, updateSlaPolicies, type SlaPolicy, type TeamRef } from '../api/client';

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export function SlaSettingsPage({ teamsList }: { teamsList: TeamRef[] }) {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTeamId) {
      setPolicies([]);
      return;
    }
    loadPolicies(selectedTeamId);
  }, [selectedTeamId]);

  async function loadPolicies(teamId: string) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchSlaPolicies(teamId);
      setPolicies(response.data);
    } catch (err) {
      setError('Unable to load SLA policies.');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedTeamId) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = policies.map((policy) => ({
        priority: policy.priority,
        firstResponseHours: Number(policy.firstResponseHours),
        resolutionHours: Number(policy.resolutionHours)
      }));
      const response = await updateSlaPolicies(selectedTeamId, payload);
      setPolicies(response.data);
      setNotice('SLA settings saved.');
    } catch (err) {
      setError('Unable to save SLA policies.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selectedTeamId) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await resetSlaPolicies(selectedTeamId);
      setPolicies(response.data);
      setNotice('SLA settings reset to defaults.');
    } catch (err) {
      setError('Unable to reset SLA policies.');
    } finally {
      setSaving(false);
    }
  }

  const policyMap = useMemo(() => {
    const map = new Map(policies.map((policy) => [policy.priority, policy]));
    return PRIORITIES.map((priority) => ({
      priority,
      data: map.get(priority) ?? {
        priority,
        firstResponseHours: 0,
        resolutionHours: 0,
        source: 'default' as const
      }
    }));
  }, [policies]);

  function updatePolicy(priority: string, field: 'firstResponseHours' | 'resolutionHours', value: string) {
    setPolicies((prev) => {
      const next = [...prev];
      const index = next.findIndex((policy) => policy.priority === priority);
      const numeric = Number(value);
      if (index === -1) {
        next.push({
          priority,
          firstResponseHours: field === 'firstResponseHours' ? numeric : 0,
          resolutionHours: field === 'resolutionHours' ? numeric : 0,
          source: 'team'
        });
      } else {
        next[index] = {
          ...next[index],
          [field]: numeric,
          source: 'team'
        };
      }
      return next;
    });
  }

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">SLA settings</h3>
            <p className="text-sm text-slate-500">Configure SLA targets per department.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!selectedTeamId || saving || loading}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedTeamId || saving || loading}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            <option value="">Select department</option>
            {teamsList.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {error && <span className="text-xs text-red-600">{error}</span>}
          {notice && <span className="text-xs text-emerald-600">{notice}</span>}
        </div>
      </div>

      {teamsList.length === 0 && (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-slate-900">No departments yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create departments to configure SLA policies.
          </p>
        </div>
      )}

      {teamsList.length > 0 && !selectedTeamId && (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-slate-900">Select a department</p>
          <p className="text-sm text-slate-500 mt-1">
            Choose a team to edit SLA targets by priority.
          </p>
        </div>
      )}

      {selectedTeamId && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Priority targets</h4>
            {loading && <span className="text-xs text-slate-400">Loading…</span>}
          </div>
          <div className="mt-4 space-y-3">
            {policyMap.map(({ priority, data }) => (
              <div
                key={priority}
                className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{priority}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{data.source === 'default' ? 'Using defaults' : 'Custom for this team'}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                          data.source === 'default'
                            ? 'border-slate-200 bg-slate-100 text-slate-600'
                            : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {data.source === 'default' ? 'Default' : 'Override'}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
                    Hours
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    First response
                    <input
                      type="number"
                      min={1}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700"
                      value={data.firstResponseHours}
                      onChange={(event) => updatePolicy(priority, 'firstResponseHours', event.target.value)}
                      disabled={loading || saving}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Resolution
                    <input
                      type="number"
                      min={1}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700"
                      value={data.resolutionHours}
                      onChange={(event) => updatePolicy(priority, 'resolutionHours', event.target.value)}
                      disabled={loading || saving}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
