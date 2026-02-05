import { useEffect, useState } from 'react';
import {
  ApiError,
  createAutomationRule,
  deleteAutomationRule,
  fetchAutomationRules,
  fetchCategories,
  fetchTeams,
  fetchUsers,
  testAutomationRule,
  updateAutomationRule,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRule,
  type CategoryRef,
  type TeamRef,
  type UserRef
} from '../api/client';
import type { Role } from '../types';
import { ActionEditor } from '../components/automation/ActionEditor';
import { ConditionEditor } from '../components/automation/ConditionEditor';

const TRIGGERS = [
  { value: 'TICKET_CREATED', label: 'Ticket created' },
  { value: 'STATUS_CHANGED', label: 'Status changed' },
  { value: 'SLA_APPROACHING', label: 'SLA approaching' },
  { value: 'SLA_BREACHED', label: 'SLA breached' },
] as const;

const emptyCondition: AutomationCondition = {
  field: 'subject',
  operator: 'contains',
  value: '',
};

const emptyAction: AutomationAction = {
  type: 'assign_team',
};

type FormState = {
  name: string;
  description: string;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  teamId: string;
  isActive: boolean;
};

const initialForm: FormState = {
  name: '',
  description: '',
  trigger: 'TICKET_CREATED',
  conditions: [{ ...emptyCondition }],
  actions: [{ ...emptyAction }],
  priority: 0,
  teamId: '',
  isActive: true,
};

function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.message) as { message?: string };
      if (typeof body?.message === 'string') return body.message;
    } catch {
      // not JSON
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Request failed.';
}

export function AutomationRulesPage({ role }: { role: Role }) {
  const isTeamAdmin = role === 'TEAM_ADMIN';
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editForm, setEditForm] = useState<FormState>(initialForm);
  const [testTicketId, setTestTicketId] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, { message: string; ok: boolean }>>({});

  useEffect(() => {
    loadRules();
    loadTeams();
    loadUsers();
    loadCategories();
  }, []);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAutomationRules();
      setRules(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadTeams() {
    try {
      const res = await fetchTeams();
      setTeams(res.data);
    } catch {
      // ignore
    }
  }

  async function loadUsers() {
    try {
      const res = await fetchUsers();
      setUsers(res.data);
    } catch {
      // ignore
    }
  }

  async function loadCategories() {
    try {
      const res = await fetchCategories({ includeInactive: false });
      setCategories(res.data);
    } catch {
      // ignore
    }
  }

  function addCondition() {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { ...emptyCondition }],
    }));
  }

  function updateCondition(i: number, c: AutomationCondition) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, j) => (j === i ? c : cond)),
    }));
  }

  function removeCondition(i: number) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, j) => j !== i),
    }));
  }

  function addAction() {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { ...emptyAction }],
    }));
  }

  function updateAction(i: number, a: AutomationAction) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((act, j) => (j === i ? a : act)),
    }));
  }

  function removeAction(i: number) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, j) => j !== i),
    }));
  }

  function editAddCondition() {
    setEditForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { ...emptyCondition }],
    }));
  }

  function editUpdateCondition(i: number, c: AutomationCondition) {
    setEditForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, j) => (j === i ? c : cond)),
    }));
  }

  function editRemoveCondition(i: number) {
    setEditForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, j) => j !== i),
    }));
  }

  function editAddAction() {
    setEditForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { ...emptyAction }],
    }));
  }

  function editUpdateAction(i: number, a: AutomationAction) {
    setEditForm((prev) => ({
      ...prev,
      actions: prev.actions.map((act, j) => (j === i ? a : act)),
    }));
  }

  function editRemoveAction(i: number) {
    setEditForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, j) => j !== i),
    }));
  }

  async function handleCreate() {
    setError(null);
    setNotice(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (form.conditions.length === 0 || form.conditions.every((c) => !c.field && !c.operator)) {
      setError('Add at least one condition.');
      return;
    }
    if (form.actions.length === 0) {
      setError('Add at least one action.');
      return;
    }
    try {
      const rule = await createAutomationRule({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        trigger: form.trigger,
        conditions: form.conditions,
        actions: form.actions,
        isActive: form.isActive,
        priority: form.priority,
        teamId: form.teamId || undefined,
      });
      setRules((prev) => [...prev, rule]);
      setForm(initialForm);
      setShowForm(false);
      setNotice('Automation rule created.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function startEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setEditForm({
      name: rule.name,
      description: rule.description ?? '',
      trigger: rule.trigger,
      conditions:
        rule.conditions?.length > 0
          ? rule.conditions
          : [{ ...emptyCondition }],
      actions: rule.actions?.length > 0 ? rule.actions : [{ ...emptyAction }],
      priority: rule.priority,
      teamId: rule.teamId ?? '',
      isActive: rule.isActive,
    });
    setError(null);
    setNotice(null);
  }

  async function handleUpdate(ruleId: string) {
    setError(null);
    setNotice(null);
    if (!editForm.name.trim()) {
      setError('Name is required.');
      return;
    }
    try {
      const updated = await updateAutomationRule(ruleId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        trigger: editForm.trigger,
        conditions: editForm.conditions,
        actions: editForm.actions,
        isActive: editForm.isActive,
        priority: editForm.priority,
        teamId: editForm.teamId || undefined,
      });
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
      setEditingId(null);
      setNotice('Rule updated.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDelete(ruleId: string) {
    setError(null);
    setNotice(null);
    try {
      await deleteAutomationRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setConfirmDeleteId(null);
      setNotice('Rule deleted.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleTest(ruleId: string) {
    const ticketId = testTicketId[ruleId]?.trim();
    if (!ticketId) {
      setTestResult((prev) => ({
        ...prev,
        [ruleId]: { message: 'Enter a ticket ID to test.', ok: false },
      }));
      return;
    }
    try {
      const result = await testAutomationRule(ruleId, ticketId);
      setTestResult((prev) => ({
        ...prev,
        [ruleId]: {
          message: result.message ?? (result.matched ? 'Rule would run (dry run).' : 'No match.'),
          ok: result.matched,
        },
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [ruleId]: { message: apiErrorMessage(err), ok: false },
      }));
    }
  }

  function summarizeConditions(conditions: AutomationCondition[]): string {
    if (!conditions?.length) return '—';
    return conditions
      .slice(0, 3)
      .map((c) => {
        if (c.and?.length) return `(AND × ${c.and.length})`;
        if (c.or?.length) return `(OR × ${c.or.length})`;
        const f = c.field ?? '?';
        const op = c.operator ?? '?';
        const v = c.value != null ? String(c.value) : '';
        return `${f} ${op} ${v}`.trim();
      })
      .join('; ');
  }

  function summarizeActions(actions: AutomationAction[]): string {
    if (!actions?.length) return '—';
    return actions
      .slice(0, 3)
      .map((a) => {
        const t = a.type ?? '?';
        if (t === 'assign_team' && a.teamId) return `Assign to team`;
        if (t === 'assign_user' && a.userId) return `Assign to user`;
        if (t === 'set_priority') return `Priority ${a.priority ?? ''}`;
        if (t === 'set_status') return `Status ${a.status ?? ''}`;
        return t.replace(/_/g, ' ');
      })
      .join(', ');
  }

  const teamList = teams.map((t) => ({ id: t.id, name: t.name }));
  const userList = users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
  }));
  const categoryList = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Automation rules</h3>
            <p className="text-sm text-slate-500">
              Run actions when tickets are created, status changes, or SLA is at risk.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRules}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
            >
              Refresh
            </button>
            {!showForm && (
              <button
                type="button"
                onClick={() => { setShowForm(true); setError(null); setNotice(null); }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                New rule
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900">New automation rule</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Rule name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={form.trigger}
              onChange={(e) => setForm((prev) => ({ ...prev, trigger: e.target.value }))}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={form.teamId}
              onChange={(e) => setForm((prev) => ({ ...prev, teamId: e.target.value }))}
            >
              {!isTeamAdmin && <option value="">Any team</option>}
              {isTeamAdmin && (
                <option value="" disabled>
                  Select team (team admins must scope rules to a team)
                </option>
              )}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="number"
                className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
              />
              Priority (lower runs first)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active
            </label>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Conditions (all must match)</p>
            <div className="space-y-2">
              {form.conditions.map((cond, i) => (
                <ConditionEditor
                  key={i}
                  condition={cond}
                  onChange={(c) => updateCondition(i, c)}
                  onRemove={() => removeCondition(i)}
                  teams={teamList}
                  users={userList}
                  categories={categoryList}
                />
              ))}
              <button
                type="button"
                onClick={addCondition}
                className="rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                + Add condition
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Actions</p>
            <div className="space-y-2">
              {form.actions.map((act, i) => (
                <ActionEditor
                  key={i}
                  action={act}
                  onChange={(a) => updateAction(i, a)}
                  onRemove={() => removeAction(i)}
                  teams={teamList}
                  users={userList}
                />
              ))}
              <button
                type="button"
                onClick={addAction}
                className="rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                + Add action
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Create rule
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(initialForm); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-card p-6">
          <div className="h-4 w-40 rounded-full skeleton-shimmer" />
        </div>
      )}

      {!loading && rules.length === 0 && !showForm && (
        <div className="glass-card p-6">
          <p className="text-sm text-slate-500">No automation rules yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => {
          const isEditing = editingId === rule.id;
          return (
            <div key={rule.id} className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                  {rule.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Trigger: {TRIGGERS.find((t) => t.value === rule.trigger)?.label ?? rule.trigger}
                    {rule.team ? ` · ${rule.team.name}` : ''} · Priority {rule.priority}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Conditions: {summarizeConditions(rule.conditions)}
                  </p>
                  <p className="text-xs text-slate-600">
                    Actions: {summarizeActions(rule.actions)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                      <input
                        type="text"
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-[10px]"
                        placeholder="Ticket ID"
                        value={testTicketId[rule.id] ?? ''}
                        onChange={(e) =>
                          setTestTicketId((prev) => ({ ...prev, [rule.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => handleTest(rule.id)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                      >
                        Test
                      </button>
                      {testResult[rule.id] && (
                        <span
                          className={`text-[10px] ${testResult[rule.id].ok ? 'text-emerald-600' : 'text-amber-600'}`}
                        >
                          {testResult[rule.id].message}
                        </span>
                      )}
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
                <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="Rule name"
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="Description"
                      value={editForm.description}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editForm.trigger}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, trigger: e.target.value }))}
                    >
                      {TRIGGERS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editForm.teamId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, teamId: e.target.value }))}
                    >
                      {!isTeamAdmin && <option value="">Any team</option>}
                      {isTeamAdmin && (
                        <option value="" disabled>
                          Select team (team admins must scope rules to a team)
                        </option>
                      )}
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="number"
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                        value={editForm.priority}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, priority: Number(e.target.value) }))
                        }
                      />
                      Priority
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Conditions</p>
                    <div className="space-y-2">
                      {editForm.conditions.map((cond, i) => (
                        <ConditionEditor
                          key={i}
                          condition={cond}
                          onChange={(c) => editUpdateCondition(i, c)}
                          onRemove={() => editRemoveCondition(i)}
                          teams={teamList}
                          users={userList}
                          categories={categoryList}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={editAddCondition}
                        className="rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        + Add condition
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Actions</p>
                    <div className="space-y-2">
                      {editForm.actions.map((act, i) => (
                        <ActionEditor
                          key={i}
                          action={act}
                          onChange={(a) => editUpdateAction(i, a)}
                          onRemove={() => editRemoveAction(i)}
                          teams={teamList}
                          users={userList}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={editAddAction}
                        className="rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        + Add action
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(rule.id)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
