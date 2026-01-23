import { type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { TeamRef } from '../api/client';

export type CreateTicketForm = {
  subject: string;
  description: string;
  priority: string;
  channel: string;
  assignedTeamId: string;
};

export function CreateTicketModal({
  open,
  onClose,
  onSubmit,
  error,
  teams,
  form,
  onChange
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  teams: TeamRef[];
  form: CreateTicketForm;
  onChange: (field: keyof CreateTicketForm, value: string) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Raise a new ticket</h3>
            <p className="text-sm text-slate-500">Select the department and describe the issue.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs text-slate-500">Department</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={form.assignedTeamId}
              onChange={(event) => onChange('assignedTeamId', event.target.value)}
              required
            >
              <option value="">Select department</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Subject</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={form.subject}
              onChange={(event) => onChange('subject', event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Description</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              rows={4}
              value={form.description}
              onChange={(event) => onChange('description', event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Priority</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={form.priority}
                onChange={(event) => onChange('priority', event.target.value)}
              >
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Channel</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={form.channel}
                onChange={(event) => onChange('channel', event.target.value)}
              >
                <option value="PORTAL">Portal</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 transition"
          >
            Submit ticket
          </button>
        </form>
      </div>
    </div>
  );
}
