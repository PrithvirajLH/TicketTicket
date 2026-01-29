const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const DEFAULT_EMAIL = import.meta.env.VITE_DEMO_USER_EMAIL as string | undefined;

export type UserRef = {
  id: string;
  email: string;
  displayName: string;
};

export type TeamRef = {
  id: string;
  name: string;
  assignmentStrategy?: string;
};

export type CategoryRef = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  parentId?: string | null;
  parent?: CategoryRef | null;
};

export type RoutingRule = {
  id: string;
  name: string;
  keywords: string[];
  teamId: string;
  priority: number;
  isActive: boolean;
  team?: TeamRef;
};

export type TicketRecord = {
  id: string;
  number: number;
  displayId?: string | null;
  subject: string;
  status: string;
  priority: string;
  channel?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  completedAt?: string | null;
  requester?: UserRef | null;
  assignee?: UserRef | null;
  assignedTeam?: TeamRef | null;
  category?: CategoryRef | null;
  dueAt?: string | null;
  firstResponseDueAt?: string | null;
  firstResponseAt?: string | null;
  slaPausedAt?: string | null;
};

export type TicketMessage = {
  id: string;
  body: string;
  type: string;
  createdAt: string;
  author: UserRef;
};

export type TicketEvent = {
  id: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  createdBy?: UserRef | null;
};

export type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  scanStatus?: string;
  uploadedBy: UserRef;
};

export type TicketFollower = {
  id: string;
  createdAt: string;
  user: UserRef;
};

export type TicketDetail = TicketRecord & {
  messages: TicketMessage[];
  events: TicketEvent[];
  followers: TicketFollower[];
  attachments: Attachment[];
};

export type TeamMember = {
  id: string;
  role: string;
  createdAt: string;
  user: UserRef;
  team: TeamRef;
};

export type SlaPolicy = {
  priority: string;
  firstResponseHours: number;
  resolutionHours: number;
  source?: 'team' | 'default';
};

export type TicketListResponse = {
  data: TicketRecord[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type CreateTicketPayload = {
  subject: string;
  description: string;
  priority?: string;
  channel?: string;
  assignedTeamId?: string;
  assigneeId?: string;
  requesterId?: string;
  categoryId?: string;
};

export type AddMessagePayload = {
  body: string;
  type?: string;
  authorId?: string;
};

export type AssignPayload = {
  assigneeId?: string;
};

export type TransitionPayload = {
  status: string;
};

export type TransferPayload = {
  newTeamId: string;
  assigneeId?: string;
};

export function getDemoUserEmail() {
  if (typeof window === 'undefined') {
    return DEFAULT_EMAIL ?? '';
  }
  return window.localStorage.getItem('demoUserEmail') ?? DEFAULT_EMAIL ?? '';
}

export function setDemoUserEmail(email: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const currentEmail = window.localStorage.getItem('demoUserEmail');
  if (currentEmail !== email) {
    // Clear search cache when persona changes to prevent leaking privileged data
    clearSearchCache();
  }
  window.localStorage.setItem('demoUserEmail', email);
}

function authHeaders() {
  const email = getDemoUserEmail();
  return email ? { 'x-user-email': email } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return (await response.json()) as T;
}

export function fetchTickets(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, String(value));
      }
    });
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<TicketListResponse>(`/tickets${suffix}`);
}

export function fetchTicketCounts() {
  return apiFetch<{ assignedToMe: number; triage: number; open: number }>('/tickets/counts');
}

export function fetchTicketById(id: string) {
  return apiFetch<TicketDetail>(`/tickets/${id}`);
}

export function fetchTicketFollowers(id: string) {
  return apiFetch<{ data: TicketFollower[] }>(`/tickets/${id}/followers`);
}

export function followTicket(id: string, userId?: string) {
  return apiFetch<{ data: TicketFollower[] }>(`/tickets/${id}/followers`, {
    method: 'POST',
    body: JSON.stringify(userId ? { userId } : {})
  });
}

export function unfollowTicket(id: string, userId: string = 'me') {
  return apiFetch<{ id: string }>(`/tickets/${id}/followers/${userId}`, {
    method: 'DELETE'
  });
}

export function createTicket(payload: CreateTicketPayload) {
  return apiFetch<TicketRecord>('/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function addTicketMessage(ticketId: string, payload: AddMessagePayload) {
  return apiFetch<TicketMessage>(`/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function uploadTicketAttachment(ticketId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE}/tickets/${ticketId}/attachments`, {
    method: 'POST',
    headers: {
      ...authHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Attachment upload failed');
  }

  return (await response.json()) as Attachment;
}

export async function downloadAttachment(attachmentId: string) {
  const response = await fetch(`${API_BASE}/attachments/${attachmentId}`, {
    headers: {
      ...authHeaders()
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Attachment download failed');
  }

  const blob = await response.blob();
  return blob;
}

export function assignTicket(ticketId: string, payload: AssignPayload) {
  return apiFetch<TicketRecord>(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function transitionTicket(ticketId: string, payload: TransitionPayload) {
  return apiFetch<TicketRecord>(`/tickets/${ticketId}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function transferTicket(ticketId: string, payload: TransferPayload) {
  return apiFetch<TicketRecord>(`/tickets/${ticketId}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function fetchTeams() {
  return apiFetch<{ data: TeamRef[] }>('/teams');
}

export function fetchUsers(role?: string) {
  const suffix = role ? `?role=${role}` : '';
  return apiFetch<{ data: UserRef[] }>(`/users${suffix}`);
}

export function fetchCategories(params?: { includeInactive?: boolean; q?: string; parentId?: string }) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, String(value));
      }
    });
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<{ data: CategoryRef[] }>(`/categories${suffix}`);
}

export function createCategory(payload: {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}) {
  return apiFetch<CategoryRef>('/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateCategory(id: string, payload: Partial<Omit<CategoryRef, 'id' | 'parent'>>) {
  return apiFetch<CategoryRef>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteCategory(id: string) {
  return apiFetch<{ id: string }>(`/categories/${id}`, {
    method: 'DELETE'
  });
}

export function fetchTeamMembers(teamId: string) {
  return apiFetch<{ data: TeamMember[] }>(`/teams/${teamId}/members`);
}

export function addTeamMember(teamId: string, payload: { userId: string; role?: string }) {
  return apiFetch<TeamMember>(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateTeam(teamId: string, payload: { name?: string; slug?: string; description?: string; isActive?: boolean; assignmentStrategy?: string }) {
  return apiFetch<TeamRef>(`/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function updateTeamMember(teamId: string, memberId: string, payload: { role: string }) {
  return apiFetch<TeamMember>(`/teams/${teamId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function removeTeamMember(teamId: string, memberId: string) {
  return apiFetch<{ id: string }>(`/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE'
  });
}

export function fetchRoutingRules() {
  return apiFetch<{ data: RoutingRule[] }>('/routing-rules');
}

export function fetchSlaPolicies(teamId: string) {
  return apiFetch<{ data: SlaPolicy[] }>(`/slas?teamId=${teamId}`);
}

export function updateSlaPolicies(teamId: string, policies: Array<Omit<SlaPolicy, 'source'>>) {
  return apiFetch<{ data: SlaPolicy[] }>(`/slas/${teamId}`, {
    method: 'PUT',
    body: JSON.stringify({ policies })
  });
}

export function resetSlaPolicies(teamId: string) {
  return apiFetch<{ data: SlaPolicy[] }>(`/slas/${teamId}`, {
    method: 'DELETE'
  });
}

export function createRoutingRule(payload: {
  name: string;
  keywords: string[];
  teamId: string;
  priority?: number;
  isActive?: boolean;
}) {
  return apiFetch<RoutingRule>('/routing-rules', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateRoutingRule(id: string, payload: Partial<Omit<RoutingRule, 'id' | 'team'>>) {
  return apiFetch<RoutingRule>(`/routing-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteRoutingRule(id: string) {
  return apiFetch<{ id: string }>(`/routing-rules/${id}`, {
    method: 'DELETE'
  });
}

// Search types and function
export type SearchResults = {
  tickets: Array<{
    id: string;
    number: number;
    displayId?: string | null;
    subject: string;
    status: string;
    priority: string;
    assignedTeam?: TeamRef | null;
  }>;
  users: UserRef[];
  teams: TeamRef[];
};

// Cache for users and teams to avoid hammering the API on every keystroke
// Keyed by user email to prevent leaking data across persona switches
let cachedUsers: UserRef[] | null = null;
let cachedTeams: TeamRef[] | null = null;
let usersCacheTime = 0;
let teamsCacheTime = 0;
let cacheUserEmail: string | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearSearchCache() {
  cachedUsers = null;
  cachedTeams = null;
  usersCacheTime = 0;
  teamsCacheTime = 0;
  cacheUserEmail = null;
}

/**
 * Check if cache is valid for current user, clear if user changed
 */
function validateCacheUser(): void {
  const currentEmail = getDemoUserEmail();
  if (cacheUserEmail !== null && cacheUserEmail !== currentEmail) {
    // User changed, clear cache to prevent leaking privileged data
    clearSearchCache();
  }
  cacheUserEmail = currentEmail;
}

async function getCachedUsers(): Promise<UserRef[]> {
  validateCacheUser();
  const now = Date.now();
  if (cachedUsers && now - usersCacheTime < CACHE_TTL_MS) {
    return cachedUsers;
  }
  try {
    const response = await fetchUsers();
    cachedUsers = response.data;
    usersCacheTime = now;
    return cachedUsers;
  } catch {
    // Return cached data if available, empty array otherwise
    return cachedUsers ?? [];
  }
}

async function getCachedTeams(): Promise<TeamRef[]> {
  validateCacheUser();
  const now = Date.now();
  if (cachedTeams && now - teamsCacheTime < CACHE_TTL_MS) {
    return cachedTeams;
  }
  try {
    const response = await fetchTeams();
    cachedTeams = response.data;
    teamsCacheTime = now;
    return cachedTeams;
  } catch {
    // Return cached data if available, empty array otherwise
    return cachedTeams ?? [];
  }
}

export async function searchAll(
  query: string,
  signal?: AbortSignal
): Promise<SearchResults> {
  // Check if aborted before starting
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Perform parallel searches across tickets, users (cached), and teams (cached)
  const [ticketsResponse, users, teams] = await Promise.all([
    fetchTickets({ q: query, pageSize: 5 }).catch(() => ({ data: [] })),
    getCachedUsers(),
    getCachedTeams()
  ]);

  // Check if aborted after fetching
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Filter users and teams client-side based on query
  const loweredQuery = query.toLowerCase();
  
  const filteredUsers = users.filter(
    (user) =>
      user.displayName.toLowerCase().includes(loweredQuery) ||
      user.email.toLowerCase().includes(loweredQuery)
  ).slice(0, 5);

  const filteredTeams = teams.filter(
    (team) => team.name.toLowerCase().includes(loweredQuery)
  ).slice(0, 5);

  return {
    tickets: ticketsResponse.data.map((t) => ({
      id: t.id,
      number: t.number,
      displayId: t.displayId,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      assignedTeam: t.assignedTeam
    })),
    users: filteredUsers,
    teams: filteredTeams
  };
}

// ============================================
// Notification types and functions
// ============================================

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  ticket?: {
    id: string;
    number: number;
    displayId: string | null;
    subject: string;
  } | null;
  actor?: UserRef | null;
};

export type NotificationListResponse = {
  data: NotificationRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
};

export function fetchNotifications(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, String(value));
      }
    });
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<NotificationListResponse>(`/notifications${suffix}`);
}

export function fetchUnreadNotificationCount() {
  return apiFetch<{ count: number }>('/notifications/unread-count');
}

export function markNotificationAsRead(notificationId: string) {
  return apiFetch<{ success: boolean }>(`/notifications/${notificationId}/read`, {
    method: 'PATCH'
  });
}

export function markAllNotificationsAsRead() {
  return apiFetch<{ success: boolean; count: number }>('/notifications/read-all', {
    method: 'PATCH'
  });
}

// ============================================
// Bulk ticket actions
// ============================================

export type BulkResult = {
  success: number;
  failed: number;
  errors: Array<{ ticketId: string; message: string }>;
};

export function bulkAssignTickets(ticketIds: string[], assigneeId?: string) {
  return apiFetch<BulkResult>('/tickets/bulk/assign', {
    method: 'POST',
    body: JSON.stringify({ ticketIds, assigneeId })
  });
}

export function bulkTransferTickets(ticketIds: string[], newTeamId: string, assigneeId?: string) {
  return apiFetch<BulkResult>('/tickets/bulk/transfer', {
    method: 'POST',
    body: JSON.stringify({ ticketIds, newTeamId, assigneeId })
  });
}

export function bulkStatusTickets(ticketIds: string[], status: string) {
  return apiFetch<BulkResult>('/tickets/bulk/status', {
    method: 'POST',
    body: JSON.stringify({ ticketIds, status })
  });
}

export function bulkPriorityTickets(ticketIds: string[], priority: string) {
  return apiFetch<BulkResult>('/tickets/bulk/priority', {
    method: 'POST',
    body: JSON.stringify({ ticketIds, priority })
  });
}
