import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  createCustomField,
  deleteCustomField,
  fetchCategories,
  fetchCustomFields,
  fetchTeams,
  updateCustomField,
  type CategoryRef,
  type CustomFieldRecord,
  type TeamRef
} from '../api/client';
import {
  CustomFieldEditor,
  customFieldToFormState,
  formStateToPayload,
  type CustomFieldFormState
} from '../components/CustomFieldEditor';

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Text Area',
  NUMBER: 'Number',
  DROPDOWN: 'Dropdown',
  MULTISELECT: 'Multi-select',
  DATE: 'Date',
  CHECKBOX: 'Checkbox',
  USER: 'User'
};

export function CustomFieldsAdminPage() {
  const [teamsList, setTeamsList] = useState<TeamRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [fields, setFields] = useState<CustomFieldRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomFieldFormState>(customFieldToFormState(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [teamsRes, catsRes] = await Promise.all([
          fetchTeams(),
          fetchCategories({ includeInactive: true })
        ]);
        setTeamsList(teamsRes.data);
        setCategories(catsRes.data);
      } catch {
        setError('Unable to load teams or categories.');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setFields([]);
      return;
    }
    loadFields();
  }, [selectedTeamId]);

  async function loadFields() {
    if (!selectedTeamId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchCustomFields({ teamId: selectedTeamId });
      setFields(response.data);
    } catch {
      setError('Unable to load custom fields.');
      setFields([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(customFieldToFormState(null));
    setForm((f) => ({ ...f, teamId: selectedTeamId }));
    setSaveError(null);
    setShowForm(true);
  }

  function openEdit(field: CustomFieldRecord) {
    setEditingId(field.id);
    setForm(customFieldToFormState(field));
    setSaveError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setSaveError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = formStateToPayload(form);
      if (editingId) {
        const updated = await updateCustomField(editingId, payload);
        setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        setNotice('Custom field updated.');
      } else {
        const created = await createCustomField(payload);
        if (created.teamId === selectedTeamId || !selectedTeamId) {
          setFields((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
        }
        setNotice('Custom field created.');
      }
      closeForm();
    } catch {
      setSaveError('Failed to save custom field.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this custom field? Existing values on tickets will be removed.')) return;
    setError(null);
    setNotice(null);
    try {
      await deleteCustomField(id);
      setFields((prev) => prev.filter((f) => f.id !== id));
      setNotice('Custom field deleted.');
    } catch {
      setError('Unable to delete custom field.');
    }
  }

  const teamName = teamsList.find((t) => t.id === selectedTeamId)?.name ?? 'Custom Fields';

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-slate-900">{teamName}</h3>
        <p className="text-sm text-slate-500 mt-1">
          Define custom fields per team. They appear on ticket creation and ticket detail.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500">Team</label>
            <select
              className="mt-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm min-w-[200px]"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              <option value="">Select a team</option>
              {teamsList.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          {selectedTeamId && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" /> Add Custom Field
              </button>
            </div>
          )}
        </div>

        {!selectedTeamId && (
          <p className="text-sm text-slate-500">Select a team to view and manage its custom fields.</p>
        )}

        {selectedTeamId && loading && <p className="text-sm text-slate-500">Loading…</p>}

        {selectedTeamId && !loading && fields.length === 0 && (
          <p className="text-sm text-slate-500">No custom fields for this team. Add one to get started.</p>
        )}

        {selectedTeamId && showForm && (
          <div className="glass-card p-6 mb-6 border border-slate-200/80">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">
              {editingId ? 'Edit custom field' : 'Add custom field'}
            </h4>
            <CustomFieldEditor
              form={form}
              onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              teamsList={teamsList}
              categories={categories}
              saving={saving}
              error={saveError}
            />
          </div>
        )}

        {selectedTeamId && !loading && fields.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Required</th>
                  <th className="pb-2 pl-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-900">{field.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}</td>
                    <td className="py-3 pr-4 text-slate-600">{field.isRequired ? 'Yes' : 'No'}</td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(field)}
                        className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(field.id)}
                        className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
