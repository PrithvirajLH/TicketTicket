import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Ticket,
  UserCheck,
  Users
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { createTicket, fetchTeams, getDemoUserEmail, setDemoUserEmail, type TeamRef } from './api/client';
import { CreateTicketModal, type CreateTicketForm } from './components/CreateTicketModal';
import { Sidebar, type SidebarItem } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketsPage } from './pages/TicketsPage';
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
  | 'reports'
  | 'admin';

const personas: { label: string; email: string; role: Role }[] = [
  { label: 'Employee (Jane)', email: 'jane.doe@company.com', role: 'EMPLOYEE' },
  { label: 'Agent (Alex)', email: 'alex.park@company.com', role: 'AGENT' },
  { label: 'Lead (Maria)', email: 'maria.chen@company.com', role: 'LEAD' },
  { label: 'Admin (Sam)', email: 'sam.rivera@company.com', role: 'ADMIN' }
];

const navItems: (SidebarItem & { roles: Role[] })[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'tickets', label: 'All Tickets', icon: Ticket, roles: ['AGENT', 'LEAD', 'ADMIN'] },
  { key: 'assigned', label: 'Assigned to Me', icon: UserCheck, roles: ['AGENT', 'LEAD', 'ADMIN'] },
  { key: 'created', label: 'Created by Me', icon: FileText, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'completed', label: 'Completed', icon: CheckCircle, roles: ['EMPLOYEE', 'AGENT', 'LEAD', 'ADMIN'] },
  { key: 'triage', label: 'Triage Board', icon: ClipboardList, roles: ['LEAD', 'ADMIN'] },
  { key: 'manager', label: 'Manager Views', icon: FolderKanban, roles: ['LEAD', 'ADMIN'] },
  { key: 'team', label: 'Team', icon: Users, roles: ['LEAD', 'ADMIN'] },
  { key: 'reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN'] },
  { key: 'admin', label: 'Admin', icon: Settings, roles: ['ADMIN'] }
];

function deriveNavKey(
  pathname: string,
  role: Role,
  ticketPresetStatus: StatusFilter,
  ticketPresetScope: TicketScope
): NavKey {
  if (pathname.startsWith('/tickets')) {
    if (ticketPresetStatus === 'resolved') {
      return 'completed';
    }
    if (ticketPresetScope === 'assigned') {
      return 'assigned';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

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

  function handleNavSelect(key: NavKey) {
    if (key === 'dashboard') {
      navigate('/dashboard');
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
      setTicketPresetScope('all');
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

  const visibleNav = navItems.filter((item) => item.roles.includes(currentPersona.role));

  const viewTitle = navKey === 'dashboard' ? 'Dashboard' : 'Tickets';
  const viewSubtitle =
    navKey === 'dashboard'
      ? 'Quick view of your ticket activity and updates.'
      : 'Track, filter, and manage your support requests.';

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
            personas={personas}
            onEmailChange={setCurrentEmail}
            onCreateTicket={() => setShowCreateModal(true)}
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
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

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


