export function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function departmentCode(name?: string | null) {
  if (!name) {
    return 'NA';
  }
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length === 0) {
    return 'NA';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function formatTicketId(ticket: {
  displayId?: string | null;
  assignedTeam?: { name?: string | null } | null;
  createdAt?: string;
  number?: number;
}) {
  if (ticket.displayId) {
    return ticket.displayId;
  }
  const date = ticket.createdAt ? new Date(ticket.createdAt) : null;
  if (!date || Number.isNaN(date.getTime()) || ticket.number === undefined || ticket.number === null) {
    return '—';
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const sequence = String(ticket.number).padStart(3, '0');
  return `${departmentCode(ticket.assignedTeam?.name)}_${yyyy}${mm}${dd}_${sequence}`;
}

export function initialsFor(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) {
    return 'U';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function statusBadgeClass(status?: string | null) {
  switch (status) {
    case 'NEW':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'TRIAGED':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'ASSIGNED':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'IN_PROGRESS':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'WAITING_ON_REQUESTER':
      return 'bg-pink-100 text-pink-700 border-pink-200';
    case 'WAITING_ON_VENDOR':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'REOPENED':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getSlaTone(args: {
  dueAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
  slaPausedAt?: string | null;
}) {
  const { dueAt, completedAt, status, slaPausedAt } = args;
  if (completedAt) {
    return { label: 'Met', className: 'border-emerald-200 bg-emerald-100 text-emerald-700' };
  }
  if (!dueAt) {
    return { label: 'No SLA', className: 'border-slate-200 bg-slate-100 text-slate-600' };
  }
  if (status === 'WAITING_ON_REQUESTER' || status === 'WAITING_ON_VENDOR') {
    return {
      label: slaPausedAt ? 'Paused' : 'Waiting',
      className: 'border-amber-200 bg-amber-100 text-amber-700'
    };
  }
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms < 0) {
    return { label: 'Breached', className: 'border-rose-200 bg-rose-100 text-rose-700' };
  }
  if (ms <= 4 * 60 * 60 * 1000) {
    return { label: 'At risk', className: 'border-amber-200 bg-amber-100 text-amber-700' };
  }
  return { label: 'On track', className: 'border-sky-200 bg-sky-100 text-sky-700' };
}
