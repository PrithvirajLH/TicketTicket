export type Role = 'EMPLOYEE' | 'AGENT' | 'LEAD' | 'ADMIN';

export type StatusFilter = 'open' | 'resolved' | 'all';
export type SortField = 'createdAt' | 'completedAt';
export type TicketScope = 'all' | 'assigned' | 'unassigned';

export type DashboardStats = {
  open: number;
  resolved: number;
  total: number;
};
