import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  createRoutingRule,
  deleteRoutingRule,
  fetchRoutingRules,
  updateRoutingRule,
  type RoutingRule,
  type TeamRef
} from '../api/client';

export function RoutingRulesPage({ teamsList }: { teamsList: TeamRef[] }) {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    keywords: [] as string[],
    teamId: '',
    priority: 100,
    isActive: true
  });
  const [editForm, setEditForm] = useState({
    name: '',
    keywords: [] as string[],
    teamId: '',
    priority: 100,
    isActive: true
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [editKeywordInput, setEditKeywordInput] = useState('');

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRoutingRules();
      setRules(response.data);
    } catch (err) {
      setError('Unable to load routing rules.');
    } finally {
      setLoading(false);
    }
  }

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  }, [rules]);

  function normalizeKeyword(value: string) {
    return value.trim().toLowerCase();
  }

  function addKeyword(list: string[], value: string) {
    const normalized = normalizeKeyword(value);
    if (!normalized) {
      return list;
    }
    if (list.includes(normalized)) {
      return list;
    }
    return [...list, normalized];
  }

  function removeKeyword(list: string[], value: string) {
    return list.filter((item) => item !== value);
  }

  async function handleCreate() {
    setError(null);
    setNotice(null);
    if (!form.name.trim() || form.keywords.length === 0 || !form.teamId) {
      setError('Name, team, and keywords are required.');
      return;
    }
    try {
      const rule = await createRoutingRule({
        name: form.name.trim(),
        keywords: form.keywords,
        teamId: form.teamId,
        priority: Number(form.priority),
        isActive: form.isActive
      });
      setRules((prev) => [...prev, rule]);
      setForm({ name: '', keywords: [], teamId: '', priority: 100, isActive: true });
      setKeywordInput('');
      setNotice('Routing rule created.');
    } catch (err) {
      setError('Unable to create routing rule.');
    }
  }

  function startEdit(rule: RoutingRule) {
    setEditingId(rule.id);
    setEditForm({
      name: rule.name,
      keywords: rule.keywords,
      teamId: rule.teamId,
      priority: rule.priority,
      isActive: rule.isActive
    });
    setEditKeywordInput('');
  }

  async function handleUpdate(ruleId: string) {
    setError(null);
    setNotice(null);
    if (!editForm.name.trim() || editForm.keywords.length === 0 || !editForm.teamId) {
      setError('Name, team, and keywords are required.');
      return;
    }
    try {
      const updated = await updateRoutingRule(ruleId, {
        name: editForm.name.trim(),
        keywords: editForm.keywords,
        teamId: editForm.teamId,
        priority: Number(editForm.priority),
        isActive: editForm.isActive
      });
      setRules((prev) => prev.map((item) => (item.id === ruleId ? updated : item)));
      setEditingId(null);
      setNotice('Routing rule updated.');
    } catch (err) {
      setError('Unable to update routing rule.');
    }
  }

  async function handleDelete(ruleId: string) {
    setError(null);
    setNotice(null);
    try {
      await deleteRoutingRule(ruleId);
      setRules((prev) => prev.filter((item) => item.id !== ruleId));
      setNotice('Routing rule deleted.');
      setConfirmDeleteId(null);
    } catch (err) {
      setError('Unable to delete routing rule.');
    }
  }

  function renderKeywordChips(keywords: string[], onRemove?: (keyword: string) => void) {
    if (keywords.length === 0) {
      return null;
    }
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span
            key={`chip-${keyword}`}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
          >
            {keyword}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(keyword)}
                className="ml-1 rounded-full border border-slate-200 bg-white px-1 text-[10px] text-slate-500"
              >
                x
              </button>
            )}
          </span>
        ))}
      </div>
    );
  }

  function handleKeywordInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    list: string[],
    setList: (next: string[]) => void,
    inputValue: string,
    setInput: (value: string) => void
  ) {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault();
      const next = addKeyword(list, inputValue);
      setList(next);
      setInput('');
    } else if (event.key === 'Backspace' && inputValue.length === 0 && list.length > 0) {
      event.preventDefault();
      setList(list.slice(0, -1));
    }
  }

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Routing rules</h3>
            <p className="text-sm text-slate-500">Automatically route tickets based on keywords.</p>
          </div>
          <button
            type="button"
            onClick={loadRules}
            className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.4fr_auto]">
          <input
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            placeholder="Rule name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            placeholder="Add keyword and press Enter"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) =>
              handleKeywordInputKeyDown(
                event,
                form.keywords,
                (next) => setForm((prev) => ({ ...prev, keywords: next })),
                keywordInput,
                setKeywordInput
              )
            }
          />
          <select
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            value={form.teamId}
            onChange={(event) => setForm((prev) => ({ ...prev, teamId: event.target.value }))}
          >
            <option value="">Select team</option>
            {teamsList.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Add rule
          </button>
        </div>
        {renderKeywordChips(form.keywords, (keyword) =>
          setForm((prev) => ({ ...prev, keywords: removeKeyword(prev.keywords, keyword) }))
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          {error && <span className="text-red-600">{error}</span>}
          {notice && <span className="text-emerald-600">{notice}</span>}
        </div>
      </div>

      {loading && (
        <div className="glass-card p-6">
          <div className="h-4 w-40 rounded-full skeleton-shimmer" />
        </div>
      )}

      {!loading && sortedRules.length === 0 && (
        <div className="glass-card p-6">
          <p className="text-sm text-slate-500">No routing rules yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {sortedRules.map((rule) => {
          const isEditing = editingId === rule.id;
          return (
            <div key={rule.id} className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {rule.team?.name ?? 'Unassigned'} · Priority {rule.priority}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.keywords.map((keyword) => (
                      <span
                        key={`${rule.id}-${keyword}`}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold ${
                      rule.isActive
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(rule)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === rule.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(rule.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rule.id)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.4fr_auto]">
                  <input
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <input
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    placeholder="Add keyword and press Enter"
                    value={editKeywordInput}
                    onChange={(event) => setEditKeywordInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleKeywordInputKeyDown(
                        event,
                        editForm.keywords,
                        (next) => setEditForm((prev) => ({ ...prev, keywords: next })),
                        editKeywordInput,
                        setEditKeywordInput
                      )
                    }
                  />
                  <select
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.teamId}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, teamId: event.target.value }))}
                  >
                    <option value="">Select team</option>
                    {teamsList.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, priority: Number(event.target.value) }))
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))
                        }
                      />
                      Active
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(rule.id)}
                        className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  </div>
                  {renderKeywordChips(editForm.keywords, (keyword) =>
                    setEditForm((prev) => ({ ...prev, keywords: removeKeyword(prev.keywords, keyword) }))
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
