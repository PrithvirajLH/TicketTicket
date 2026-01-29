import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Ticket,
  UserCheck,
  Users
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  createTicket,
  fetchTeams,
  fetchTicketCounts,
  getDemoUserEmail,
  setDemoUserEmail,
  type TeamRef
} from './api/client';
import { CommandPalette } from './components/CommandPalette';
import { CreateTicketModal, type CreateTicketForm } from './components/CreateTicketModal';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { Sidebar, type SidebarItem } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useCommandPalette } from './hooks/useCommandPalette';
import { getShortcutContext, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useNotifications } from './hooks/useNotifications';
import { DashboardPage } from './pages/DashboardPage';
import { ManagerViewsPage } from './pages/ManagerViewsPage';
import { SlaSettingsPage } from './pages/SlaSettingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { RoutingRulesPage } from './pages/RoutingRulesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { TeamPage } from './pages/TeamPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketsPage } from './pages/TicketsPage';
import { TriageBoardPage } from './pages/TriageBoardPage';
import type { Role, StatusFilter, TicketScope } from './types';

type NavKey =
  | 'dashboard'
  | 'tickets'
  | 'assigned'
  | 'created'
  | 'completed'
  | 'triage'
  | 'manager'
  | 'team'
  | 'sla-settings'
  | 'reports'
  | 'admin';

const defaultPersonas: { label: string; email: string; role: Role }[] = [
  { label: 'Employee (Jane)', email: 'jane.doe@company.com', role: 'EMPLOYEE' },
  { label: 'Agent (Alex)', email: 'alex.park@company.com', role: 'AGENT' },
  { label: 'Lead (Maria)', email: 'maria.chen@company.com', role: 'LEAD' },
  { label: 'Admin (Sam)', email: 'sam.rivera@company.com', role: 'ADMIN' }
];

const e2ePersonas: { label: string; email: string; role: Role }[] = [
  { label: 'Requester (Test)', email: 'requester@company.com', role: 'EMPLOYEE' },
  { label: 'Agent (Test)', email: 'agent@company.com', role: 'AGENT' },
  { label: 'Lead (Test)', email: 'lead@company.com', role: 'LEAD' },
  { label: 'Admin (Test)', email: 'admin@company.com', role: 'ADMIN' }
];

const personas = import.meta.env.VITE_E2E_MODE === 'true' ? e2ePersonas : defaultPersonas;

const navItems: (SidebarItem & { roles: Role[] })[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'tickets', label: 'All Tickets', icon: Ticket, roles: ['AGENT', 'LEAD', 'ADMIN'] },
  { key: 'assigned', label: 'Assigned to Me', icon: UserCheck, roles: ['AGENT', 'LEAD', 'ADMIN'] },
  { key: 'created', label: 'Created by Me', icon: FileText, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'completed', label: 'Completed', icon: CheckCircle, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'triage', label: 'Triage Board', icon: ClipboardList, roles: ['LEAD', 'ADMIN'] },
  { key: 'manager', label: 'Manager Views', icon: FolderKanban, roles: ['LEAD', 'ADMIN'] },
  { key: 'team', label: 'Team', icon: Users, roles: ['LEAD', 'ADMIN'] },
  { key: 'sla-settings', label: 'SLA Settings', icon: Clock, roles: ['ADMIN'] },
  { key: 'reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN'] },
  { key: 'admin', label: 'Admin', icon: Settings, roles: ['ADMIN'] }
];

function deriveNavKey(
  pathname: string,
  role: Role,
  ticketPresetStatus: StatusFilter,
  ticketPresetScope: TicketScope
): NavKey {
  if (pathname.startsWith('/triage')) {
    return 'triage';
  }
  if (pathname.startsWith('/manager')) {
    return 'manager';
  }
  if (pathname.startsWith('/team')) {
    return 'team';
  }
  if (pathname.startsWith('/sla-settings')) {
    return 'sla-settings';
  }
  if (pathname.startsWith('/routing') || pathname.startsWith('/categories')) {
    return 'admin';
  }
  if (pathname.startsWith('/reports')) {
    return 'reports';
  }
  if (pathname.startsWith('/admin')) {
    return 'admin';
  }
  if (pathname.startsWith('/tickets')) {
    if (ticketPresetScope === 'assigned') {
      return 'assigned';
    }
    if (ticketPresetScope === 'created') {
      return 'created';
    }
    if (ticketPresetStatus === 'resolved') {
      return 'completed';
    }
    return role === 'EMPLOYEE' ? 'created' : 'tickets';
  }
  return 'dashboard';
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentEmail, setCurrentEmail] = useState(() => getDemoUserEmail() || personas[0].email);
  const currentPersona = useMemo(
    () => personas.find((persona) => persona.email === currentEmail) ?? personas[0],
    [currentEmail]
  );

  useEffect(() => {
    const isValid = personas.some((persona) => persona.email === currentEmail);
    if (!isValid) {
      setCurrentEmail(personas[0].email);
    }
  }, [currentEmail, personas]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const [navKey, setNavKey] = useState<NavKey>('dashboard');
  const [ticketPresetStatus, setTicketPresetStatus] = useState<StatusFilter>('open');
  const [ticketPresetScope, setTicketPresetScope] = useState<TicketScope>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const [teamsList, setTeamsList] = useState<TeamRef[]>([]);
  const [ticketCounts, setTicketCounts] = useState<{
    assignedToMe: number;
    triage: number;
    open: number;
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Command Palette state with Cmd+N shortcut for new ticket
  const commandPalette = useCommandPalette({
    onCreateTicket: () => setShowCreateModal(true)
  });

  // Notifications state with polling
  // Pass currentEmail as userKey to reset notifications on persona switch
  const notifications = useNotifications({
    pollingInterval: 30000, // 30 seconds
    enablePolling: true,
    userKey: currentEmail
  });

  // Keyboard shortcuts: ? (help), Cmd+/ (focus search)
  const keyboardShortcuts = useKeyboardShortcuts();
  const shortcutContext = getShortcutContext(location.pathname);

  const [createForm, setCreateForm] = useState<CreateTicketForm>({
    subject: '',
    description: '',
    priority: 'P3',
    channel: 'PORTAL',
    assignedTeamId: ''
  });

  useEffect(() => {
    setDemoUserEmail(currentEmail);
  }, [currentEmail]);

  useEffect(() => {
    setNavKey(deriveNavKey(location.pathname, currentPersona.role, ticketPresetStatus, ticketPresetScope));
  }, [location.pathname, currentPersona.role, ticketPresetStatus, ticketPresetScope]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    fetchTeams()
      .then((response) => setTeamsList(response.data))
      .catch(() => setTeamsList([]));
  }, [currentEmail]);

  useEffect(() => {
    fetchTicketCounts()
      .then(setTicketCounts)
      .catch(() => setTicketCounts(null));
  }, [currentEmail, refreshKey]);

  function handleNavSelect(key: NavKey) {
    if (key === 'dashboard') {
      navigate('/dashboard');
      return;
    }

    if (key === 'triage') {
      navigate('/triage');
      return;
    }

    if (key === 'manager') {
      navigate('/manager');
      return;
    }

    if (key === 'team') {
      navigate('/team');
      return;
    }
    if (key === 'sla-settings') {
      navigate('/sla-settings');
      return;
    }
    if (key === 'reports') {
      navigate('/reports');
      return;
    }
    if (key === 'admin') {
      navigate('/admin');
      return;
    }

    if (key === 'completed') {
      setTicketPresetStatus('resolved');
      setTicketPresetScope('all');
      navigate('/tickets');
      return;
    }

    if (key === 'assigned') {
      setTicketPresetStatus('open');
      setTicketPresetScope('assigned');
      navigate('/tickets');
      return;
    }

    if (key === 'created') {
      setTicketPresetStatus('open');
      setTicketPresetScope('created');
      navigate('/tickets');
      return;
    }

    if (key === 'tickets') {
      setTicketPresetStatus('open');
      setTicketPresetScope('all');
      navigate('/tickets');
      return;
    }

    navigate('/dashboard');
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTicketError(null);
    try {
      await createTicket({
        subject: createForm.subject,
        description: createForm.description,
        priority: createForm.priority,
        channel: createForm.channel,
        assignedTeamId: createForm.assignedTeamId
      });
      setCreateForm({ subject: '', description: '', priority: 'P3', channel: 'PORTAL', assignedTeamId: '' });
      setShowCreateModal(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setTicketError('Unable to create ticket.');
    }
  }

  const visibleNav = useMemo(() => {
    const filtered = navItems.filter((item) => item.roles.includes(currentPersona.role));
    return filtered.map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      badge:
        item.key === 'assigned'
          ? ticketCounts?.assignedToMe
          : item.key === 'triage'
            ? ticketCounts?.triage
            : item.key === 'tickets'
              ? ticketCounts?.open
              : undefined
    }));
  }, [currentPersona.role, ticketCounts]);

  const viewMeta: Record<NavKey, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Quick view of your ticket activity and updates.'
    },
    tickets: {
      title: 'All Tickets',
      subtitle: 'Track, filter, and manage your support requests.'
    },
    assigned: {
      title: 'Assigned to Me',
      subtitle: 'Tickets waiting for your action.'
    },
    created: {
      title: currentPersona.role === 'EMPLOYEE' ? 'My Tickets' : 'Created by Me',
      subtitle: 'Requests you have opened or own.'
    },
    completed: {
      title: 'Completed',
      subtitle: 'Closed and resolved tickets.'
    },
    triage: {
      title: 'Triage Board',
      subtitle: 'Monitor open tickets by status.'
    },
    manager: {
      title: 'Manager Views',
      subtitle: 'High-level ticket volume and workload insights.'
    },
    team: {
      title: 'Team',
      subtitle: 'Manage members and roles.'
    },
    'sla-settings': {
      title: 'SLA Settings',
      subtitle: 'Configure SLA targets per department.'
    },
    reports: {
      title: 'Reports',
      subtitle: 'Operational reporting (coming soon).'
    },
    admin: {
      title: 'Admin',
      subtitle: 'Configuration and settings.'
    }
  };

  const viewTitleOverride = location.pathname.startsWith('/routing')
    ? 'Routing Rules'
    : location.pathname.startsWith('/categories')
    ? 'Categories'
    : undefined;
  const viewSubtitleOverride = location.pathname.startsWith('/routing')
    ? 'Manage keyword-based routing logic.'
    : location.pathname.startsWith('/categories')
    ? 'Organize ticket categories and subcategories.'
    : undefined;

  const viewTitle = viewTitleOverride ?? viewMeta[navKey]?.title ?? 'Dashboard';
  const viewSubtitle =
    viewSubtitleOverride ?? viewMeta[navKey]?.subtitle ?? 'Quick view of your ticket activity and updates.';

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="flex">
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
          items={visibleNav}
          activeKey={navKey}
          onSelect={(key) => handleNavSelect(key as NavKey)}
          currentRole={currentPersona.role}
        />

        <main
          className={`flex-1 px-10 py-8 transition-all duration-300 h-screen overflow-y-auto ${
            isSidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
        >
          <TopBar
            title={viewTitle}
            subtitle={viewSubtitle}
            currentEmail={currentEmail}
            currentLabel={currentPersona.label}
            personas={personas}
            onEmailChange={setCurrentEmail}
            onCreateTicket={() => setShowCreateModal(true)}
            onOpenSearch={commandPalette.open}
            notificationProps={{
              notifications: notifications.notifications,
              unreadCount: notifications.unreadCount,
              loading: notifications.loading,
              hasMore: notifications.hasMore,
              onLoadMore: notifications.loadMore,
              onMarkAsRead: notifications.markAsRead,
              onMarkAllAsRead: notifications.markAllAsRead,
              onRefresh: notifications.refresh
            }}
          />

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  refreshKey={refreshKey}
                />
              }
            />
            <Route
              path="/triage"
              element={
                currentPersona.role === 'LEAD' || currentPersona.role === 'ADMIN' ? (
                  <TriageBoardPage
                    refreshKey={refreshKey}
                    teamsList={teamsList}
                    currentEmail={currentEmail}
                  />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/manager"
              element={
                currentPersona.role === 'LEAD' || currentPersona.role === 'ADMIN' ? (
                  <ManagerViewsPage refreshKey={refreshKey} teamsList={teamsList} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/team"
              element={
                currentPersona.role === 'LEAD' || currentPersona.role === 'ADMIN' ? (
                  <TeamPage refreshKey={refreshKey} teamsList={teamsList} role={currentPersona.role} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/sla-settings"
              element={
                currentPersona.role === 'ADMIN' ? (
                  <SlaSettingsPage teamsList={teamsList} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/reports"
              element={
                currentPersona.role === 'ADMIN' ? (
                  <ReportsPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={
                currentPersona.role === 'ADMIN' ? (
                  <AdminPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/routing"
              element={
                currentPersona.role === 'ADMIN' ? (
                  <RoutingRulesPage teamsList={teamsList} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/categories"
              element={
                currentPersona.role === 'ADMIN' ? (
                  <CategoriesPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/tickets"
              element={
                <TicketsPage
                  role={currentPersona.role}
                  currentEmail={currentEmail}
                  presetStatus={ticketPresetStatus}
                  presetScope={ticketPresetScope}
                  refreshKey={refreshKey}
                  teamsList={teamsList}
                />
              }
            />
            <Route
              path="/tickets/:ticketId"
              element={
                <TicketDetailPage
                  refreshKey={refreshKey}
                  currentEmail={currentEmail}
                  role={currentPersona.role}
                  teamsList={teamsList}
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        recentSearches={commandPalette.recentSearches}
        onSearch={commandPalette.addRecentSearch}
        onClearRecent={commandPalette.clearRecentSearches}
        onCreateTicket={() => setShowCreateModal(true)}
        currentRole={currentPersona.role}
      />

      <KeyboardShortcutsHelp
        open={keyboardShortcuts.showHelp}
        onClose={keyboardShortcuts.closeHelp}
        context={shortcutContext}
      />

      <CreateTicketModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTicket}
        error={ticketError}
        teams={teamsList}
        form={createForm}
        onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
      />
    </div>
  );
}

export default App;
