import type { TicketRecord } from '../api/client';
import { RelativeTime } from './RelativeTime';
import { formatStatus, formatTicketId, getSlaTone, statusBadgeClass } from '../utils/format';

function priorityBadgeClass(priority?: string | null) {
  switch (priority) {
    case 'P1':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'P2':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'P3':
      return 'border-indigo-200 bg-indigo-50 text-indigo-800';
    case 'P4':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function initialsFromUser(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email && email.trim()) || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function Avatar({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/30 text-[11px] font-semibold text-foreground">
      {initialsFromUser(name, email)}
    </span>
  );
}

type TicketTableViewProps = {
  tickets: TicketRecord[];
  role: string;
  selection: {
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
    toggleAll: () => void;
    isAllSelected: boolean;
  };
  onRowClick: (ticket: TicketRecord) => void;
};

export function TicketTableView({
  tickets,
  role,
  selection,
  onRowClick,
}: TicketTableViewProps) {
  const showCheckbox = role !== 'EMPLOYEE';

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-sm font-semibold text-foreground">
              {showCheckbox ? (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected}
                    onChange={selection.toggleAll}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring/30"
                    aria-label="Select all tickets"
                  />
                </th>
              ) : null}
              <th className="w-28 px-3 py-3">ID</th>
              <th className="px-3 py-3">Ticket</th>
              <th className="w-[220px] px-3 py-3">Requester</th>
              <th className="w-28 px-3 py-3">Priority</th>
              <th className="w-40 px-3 py-3">Status</th>
              <th className="w-[240px] px-3 py-3">Assignee</th>
              <th className="w-36 px-3 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, index) => {
              const sla = getSlaTone({
                dueAt: ticket.dueAt,
                completedAt: ticket.completedAt,
                status: ticket.status,
                slaPausedAt: ticket.slaPausedAt,
              });
              const requesterName = ticket.requester?.displayName ?? ticket.requester?.email ?? 'Unknown';
              const requesterEmail = ticket.requester?.email ?? 'No email';
              const assigneeName = ticket.assignee?.displayName ?? ticket.assignee?.email ?? 'Unassigned';
              const assigneeEmail = ticket.assignee?.email ?? '';
              const assigneeTeam = ticket.assignedTeam?.name ?? 'No team';
              const category = ticket.category?.name ?? 'No category';
              return (
                <tr
                  key={ticket.id}
                  onClick={() => onRowClick(ticket)}
                  className={`cursor-pointer border-b border-border/70 text-sm transition-colors hover:bg-muted/20 ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/[0.08]'
                  }`}
                >
                  {showCheckbox ? (
                    <td
                      className="px-3 py-3 align-top"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selection.isSelected(ticket.id)}
                        onChange={() => selection.toggle(ticket.id)}
                        className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring/30"
                        aria-label={`Select ticket ${ticket.subject}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 align-top">
                    <span className="font-mono text-lg leading-none text-slate-600">
                      {formatTicketId(ticket)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold leading-tight text-foreground">{ticket.subject}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{category}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <Avatar name={requesterName} email={requesterEmail} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight text-foreground">{requesterName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{requesterEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass(ticket.priority)}`}>
                      {ticket.priority ?? 'P3'}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(ticket.status)}`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                    {sla.label !== 'On track' ? (
                      <p className="mt-1 text-xs text-muted-foreground">{sla.label}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <Avatar name={assigneeName} email={assigneeEmail} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight text-foreground">{assigneeName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{assigneeTeam}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-muted-foreground">
                    <RelativeTime value={ticket.createdAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
