import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock4,
  FolderKanban,
  Gauge,
  Layers,
  LifeBuoy,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users
} from 'lucide-react';
import {
  addTicketMessage,
  addTeamMember,
  createCategory,
  assignTicket,
  createRoutingRule,
  createTicket,
  deleteCategory,
  deleteRoutingRule,
  fetchCategories,
  fetchRoutingRules,
  fetchTeams,
  fetchTicketById,
  fetchTickets,
  fetchTeamMembers,
  fetchUsers,
  getDemoUserEmail,
  setDemoUserEmail,
  updateCategory,
  transitionTicket,
  transferTicket,
  updateRoutingRule,
  removeTeamMember,
  updateTeamMember,
  type CategoryRef,
  type RoutingRule,
  type TeamMember,
  type TicketDetail,
  type TicketRecord,
  type TeamRef,
  type UserRef
} from './api/client';

const stats = [
  { label: 'Open tickets', value: '248', change: '+12 today', tone: 'up' },
  { label: 'SLA at risk', value: '14', change: '2 escalations', tone: 'warn' },
  { label: 'Median first response', value: '18m', change: '95% on target', tone: 'good' },
  { label: 'Automation coverage', value: '62%', change: '+8% this quarter', tone: 'up' }
];

const teams = [
  { name: 'IT Service Desk', backlog: 76, sla: 92, trend: 'stable', priority: 'P2' },
  { name: 'HR Operations', backlog: 41, sla: 96, trend: 'up', priority: 'P3' },
  { name: 'AI Enablement', backlog: 23, sla: 89, trend: 'down', priority: 'P2' },
  { name: 'Medicaid Pending', backlog: 52, sla: 84, trend: 'down', priority: 'P1' },
  { name: 'White Gloves', backlog: 9, sla: 99, trend: 'up', priority: 'P1' }
];

const fallbackTickets = [
  {
    id: 'TCK-2041',
    subject: 'VPN access for new contractor',
    team: 'IT Service Desk',
    priority: 'P2',
    status: 'Triaged',
    updated: '12 min ago'
  },
  {
    id: 'TCK-2035',
    subject: 'Medicaid eligibility verification update',
    team: 'Medicaid Pending',
    priority: 'P1',
    status: 'Assigned',
    updated: '26 min ago'
  },
  {
    id: 'TCK-2030',
    subject: 'Executive laptop replacement request',
    team: 'White Gloves',
    priority: 'P2',
    status: 'New',
    updated: '1 hr ago'
  },
  {
    id: 'TCK-2027',
    subject: 'AI model access policy review',
    team: 'AI Enablement',
    priority: 'P3',
    status: 'In Progress',
    updated: '2 hrs ago'
  }
];

const activity = [
  {
    icon: <Sparkles size={18} />,
    title: 'Routing rule applied',
    description: 'Auto-assigned 14 HR onboarding tickets to Maria Chen.'
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Security review complete',
    description: 'New admin role for AI Enablement approved.'
  },
  {
    icon: <Clock4 size={18} />,
    title: 'SLA checkpoint',
    description: '5 Medicaid tickets nearing P1 response window.'
  }
];

const personas = [
  { label: 'Requester (Jane)', email: 'jane.doe@company.com', role: 'Requester' },
  { label: 'Agent (Alex)', email: 'alex.park@company.com', role: 'Agent' },
  { label: 'Lead (Maria)', email: 'maria.chen@company.com', role: 'Lead' },
  { label: 'Admin (Sam)', email: 'sam.rivera@company.com', role: 'Admin' }
];

const statusOptions = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_ON_REQUESTER',
  'WAITING_ON_VENDOR',
  'RESOLVED',
  'CLOSED',
  'REOPENED'
];

function formatUpdated(value: string) {
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

function toTitle(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function App() {
  const [view, setView] = useState<'overview' | 'requester' | 'agent' | 'routing' | 'teams'>('overview');
  const [ticketRows, setTicketRows] = useState(fallbackTickets);
  const [currentEmail, setCurrentEmail] = useState(() => {
    const stored = getDemoUserEmail();
    return stored || personas[0].email;
  });
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [teamsList, setTeamsList] = useState<TeamRef[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [usersList, setUsersList] = useState<UserRef[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [routingForm, setRoutingForm] = useState({
    name: '',
    keywords: '',
    teamId: '',
    priority: 50,
    isActive: true
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isActive: true
  });
  const [memberForm, setMemberForm] = useState({
    userId: '',
    role: 'AGENT'
  });
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [loadingRouting, setLoadingRouting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState('PUBLIC');
  const [transitionStatus, setTransitionStatus] = useState('IN_PROGRESS');
  const [transferTeamId, setTransferTeamId] = useState('');
  const [createForm, setCreateForm] = useState({
    subject: '',
    description: '',
    priority: 'P3',
    channel: 'PORTAL'
  });

  const currentPersona = useMemo(
    () => personas.find((persona) => persona.email === currentEmail) ?? personas[0],
    [currentEmail]
  );
  const isAdmin = currentPersona.role === 'Admin';

  useEffect(() => {
    setDemoUserEmail(currentEmail);
  }, [currentEmail]);

  useEffect(() => {
    let mounted = true;
    fetchTickets()
      .then((response) => {
        if (!mounted) {
          return;
        }
        const mapped = response.data.map((ticket) => ({
          id: `TCK-${ticket.number}`,
          subject: ticket.subject,
          team: ticket.assignedTeam?.name ?? 'Unassigned',
          priority: ticket.priority,
          status: toTitle(ticket.status),
          updated: formatUpdated(ticket.updatedAt)
        }));
        setTicketRows(mapped);
      })
      .catch(() => {
        if (mounted) {
          setTicketRows(fallbackTickets);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentEmail]);

  useEffect(() => {
    if (view !== 'requester' && view !== 'agent') {
      return;
    }

    loadTickets();
  }, [view, currentEmail]);

  useEffect(() => {
    if (view === 'agent' || view === 'routing' || view === 'teams') {
      fetchTeams()
        .then((response) => {
          setTeamsList(response.data);
          if (view === 'teams' && response.data.length > 0) {
            setSelectedTeamId((prev) => prev || response.data[0].id);
          }
        })
        .catch(() => setTeamsList([]));
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'routing') {
      return;
    }
    loadRoutingRules();
  }, [view, currentEmail]);

  useEffect(() => {
    if (view !== 'teams') {
      return;
    }
    loadCategories();
    fetchUsers()
      .then((response) => setUsersList(response.data))
      .catch(() => setUsersList([]));
  }, [view, currentEmail]);

  async function loadTickets() {
    setLoadingTickets(true);
    setTicketError(null);
    try {
      const response = await fetchTickets();
      setTickets(response.data);
      if (response.data.length && !selectedTicketId) {
        setSelectedTicketId(response.data[0].id);
      }
    } catch (error) {
      setTicketError('Unable to load tickets for this user.');
    } finally {
      setLoadingTickets(false);
    }
  }

  async function loadTicketDetail(id: string) {
    setLoadingDetail(true);
    try {
      const detail = await fetchTicketById(id);
      setSelectedTicket(detail);
    } catch (error) {
      setTicketError('Unable to load ticket details.');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadRoutingRules() {
    setLoadingRouting(true);
    setRoutingError(null);
    try {
      const response = await fetchRoutingRules();
      setRoutingRules(response.data);
    } catch (error) {
      setRoutingError('Unable to load routing rules.');
    } finally {
      setLoadingRouting(false);
    }
  }

  async function loadCategories() {
    setLoadingCategories(true);
    setCategoryError(null);
    try {
      const response = await fetchCategories({ includeInactive: isAdmin });
      setCategories(response.data);
    } catch (error) {
      setCategoryError('Unable to load categories.');
    } finally {
      setLoadingCategories(false);
    }
  }

  async function loadTeamMembers(teamId: string) {
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const response = await fetchTeamMembers(teamId);
      setTeamMembers(response.data);
    } catch (error) {
      setMemberError('Unable to load team members.');
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    if (!selectedTicketId || view === 'overview' || view === 'routing' || view === 'teams') {
      setSelectedTicket(null);
      return;
    }

    loadTicketDetail(selectedTicketId);
  }, [selectedTicketId, view]);

  useEffect(() => {
    if (view !== 'teams' || !selectedTeamId) {
      setTeamMembers([]);
      return;
    }
    loadTeamMembers(selectedTeamId);
  }, [view, selectedTeamId, currentEmail]);

  const portalTickets = tickets;
  const myTickets = tickets.filter((ticket) => ticket.assignee?.email === currentEmail);
  const unassignedTickets = tickets.filter((ticket) => !ticket.assignee);

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTicketError(null);
    try {
      const created = await createTicket({
        subject: createForm.subject,
        description: createForm.description,
        priority: createForm.priority,
        channel: createForm.channel
      });
      setCreateForm({ subject: '', description: '', priority: 'P3', channel: 'PORTAL' });
      await loadTickets();
      setSelectedTicketId(created.id);
    } catch (error) {
      setTicketError('Unable to create ticket.');
    }
  }

  async function handleReply(typeOverride?: string) {
    if (!selectedTicketId) {
      return;
    }
    setTicketError(null);
    const body = typeOverride ? noteBody : messageBody;
    if (!body.trim()) {
      return;
    }
    try {
      await addTicketMessage(selectedTicketId, { body, type: typeOverride ?? 'PUBLIC' });
      if (typeOverride) {
        setNoteBody('');
      } else {
        setMessageBody('');
      }
      await loadTicketDetail(selectedTicketId);
    } catch (error) {
      setTicketError('Unable to add message.');
    }
  }

  async function handleAssign(ticketId: string) {
    setTicketError(null);
    try {
      await assignTicket(ticketId, {});
      await loadTickets();
      await loadTicketDetail(ticketId);
    } catch (error) {
      setTicketError('Unable to assign ticket.');
    }
  }

  async function handleTransition(ticketId: string) {
    setTicketError(null);
    try {
      await transitionTicket(ticketId, { status: transitionStatus });
      await loadTickets();
      await loadTicketDetail(ticketId);
    } catch (error) {
      setTicketError('Unable to update status.');
    }
  }

  async function handleTransfer(ticketId: string) {
    if (!transferTeamId) {
      return;
    }
    setTicketError(null);
    try {
      await transferTicket(ticketId, { newTeamId: transferTeamId });
      await loadTickets();
      await loadTicketDetail(ticketId);
    } catch (error) {
      setTicketError('Unable to transfer ticket.');
    }
  }

  async function handleCreateRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setRoutingError('Admin access required to create rules.');
      return;
    }
    setRoutingError(null);
    try {
      const keywords = routingForm.keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean);
      await createRoutingRule({
        name: routingForm.name,
        teamId: routingForm.teamId,
        keywords,
        priority: Number(routingForm.priority),
        isActive: routingForm.isActive
      });
      setRoutingForm({
        name: '',
        keywords: '',
        teamId: '',
        priority: 50,
        isActive: true
      });
      await loadRoutingRules();
    } catch (error) {
      setRoutingError('Unable to create routing rule.');
    }
  }

  async function handleToggleRule(rule: RoutingRule) {
    if (!isAdmin) {
      setRoutingError('Admin access required to edit rules.');
      return;
    }
    setRoutingError(null);
    try {
      await updateRoutingRule(rule.id, { isActive: !rule.isActive });
      await loadRoutingRules();
    } catch (error) {
      setRoutingError('Unable to update routing rule.');
    }
  }

  async function handleDeleteRule(rule: RoutingRule) {
    if (!isAdmin) {
      setRoutingError('Admin access required to delete rules.');
      return;
    }
    setRoutingError(null);
    try {
      await deleteRoutingRule(rule.id);
      await loadRoutingRules();
    } catch (error) {
      setRoutingError('Unable to remove routing rule.');
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setCategoryError('Admin access required to create categories.');
      return;
    }
    setCategoryError(null);
    try {
      await createCategory({
        name: categoryForm.name,
        slug: categoryForm.slug || undefined,
        description: categoryForm.description || undefined,
        parentId: categoryForm.parentId || undefined,
        isActive: categoryForm.isActive
      });
      setCategoryForm({
        name: '',
        slug: '',
        description: '',
        parentId: '',
        isActive: true
      });
      await loadCategories();
    } catch (error) {
      setCategoryError('Unable to create category.');
    }
  }

  async function handleToggleCategory(category: CategoryRef) {
    if (!isAdmin) {
      setCategoryError('Admin access required to edit categories.');
      return;
    }
    setCategoryError(null);
    try {
      await updateCategory(category.id, { isActive: !category.isActive });
      await loadCategories();
    } catch (error) {
      setCategoryError('Unable to update category.');
    }
  }

  async function handleDeleteCategory(category: CategoryRef) {
    if (!isAdmin) {
      setCategoryError('Admin access required to delete categories.');
      return;
    }
    setCategoryError(null);
    try {
      await deleteCategory(category.id);
      await loadCategories();
    } catch (error) {
      setCategoryError('Unable to remove category.');
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setMemberError('Admin access required to manage memberships.');
      return;
    }
    if (!selectedTeamId || !memberForm.userId) {
      return;
    }
    setMemberError(null);
    try {
      await addTeamMember(selectedTeamId, {
        userId: memberForm.userId,
        role: memberForm.role
      });
      setMemberForm({ userId: '', role: 'AGENT' });
      await loadTeamMembers(selectedTeamId);
    } catch (error) {
      setMemberError('Unable to add team member.');
    }
  }

  async function handleUpdateMemberRole(member: TeamMember, role: string) {
    if (!isAdmin) {
      setMemberError('Admin access required to manage memberships.');
      return;
    }
    if (!selectedTeamId) {
      return;
    }
    setMemberError(null);
    try {
      await updateTeamMember(selectedTeamId, member.id, { role });
      await loadTeamMembers(selectedTeamId);
    } catch (error) {
      setMemberError('Unable to update member role.');
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!isAdmin) {
      setMemberError('Admin access required to manage memberships.');
      return;
    }
    if (!selectedTeamId) {
      return;
    }
    setMemberError(null);
    try {
      await removeTeamMember(selectedTeamId, member.id);
      await loadTeamMembers(selectedTeamId);
    } catch (error) {
      setMemberError('Unable to remove member.');
    }
  }

  const viewTitle =
    view === 'overview'
      ? 'Operations command center'
      : view === 'requester'
      ? 'Requester portal'
      : view === 'agent'
      ? 'Agent console'
      : view === 'routing'
      ? 'Routing rules'
      : 'Admin workspace';

  const viewSubtitle =
    view === 'overview'
      ? 'Real-time coverage for IT, HR, AI, Medicaid Pending, and White Gloves.'
      : view === 'requester'
      ? 'Submit requests, track status, and keep your conversations in one place.'
      : view === 'agent'
      ? 'Triage, assign, and resolve tickets with live queue visibility.'
      : view === 'routing'
      ? 'Configure routing rules to auto-assign tickets to the right team.'
      : 'Manage categories and team memberships across departments.';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Layers size={22} />
          </div>
          <div>
            <p className="brand-title">Unified Ticketing</p>
            <span className="brand-subtitle">Enterprise Operations</span>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${view === 'overview' ? 'active' : ''}`}
            onClick={() => setView('overview')}
            type="button"
          >
            <Gauge size={18} />
            Overview
          </button>
          <button
            className={`nav-item ${view === 'requester' ? 'active' : ''}`}
            onClick={() => setView('requester')}
            type="button"
          >
            <BookOpen size={18} />
            Requester Portal
          </button>
          <button
            className={`nav-item ${view === 'agent' ? 'active' : ''}`}
            onClick={() => setView('agent')}
            type="button"
          >
            <FolderKanban size={18} />
            Agent Console
          </button>
          <button
            className={`nav-item ${view === 'teams' ? 'active' : ''}`}
            onClick={() => setView('teams')}
            type="button"
          >
            <Users size={18} />
            Teams
          </button>
          <button
            className={`nav-item ${view === 'routing' ? 'active' : ''}`}
            onClick={() => setView('routing')}
            type="button"
          >
            <SlidersHorizontal size={18} />
            Routing & SLAs
          </button>
          <button className="nav-item" type="button">
            <LifeBuoy size={18} />
            White Gloves
          </button>
          <button className="nav-item" type="button">
            <Brain size={18} />
            AI Ops
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>
            <p className="footer-label">Current workload</p>
            <p className="footer-value">98% capacity</p>
          </div>
          <button className="ghost-button" type="button">
            <CheckCircle2 size={16} />
            Manage staffing
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{viewTitle}</h1>
            <p>{viewSubtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="search">
              <Search size={16} />
              <input placeholder="Search tickets, people, or assets" />
            </div>
            <select
              className="persona-select"
              value={currentEmail}
              onChange={(event) => setCurrentEmail(event.target.value)}
            >
              {personas.map((persona) => (
                <option key={persona.email} value={persona.email}>
                  {persona.label}
                </option>
              ))}
            </select>
            <button className="icon-button" type="button">
              <Bell size={18} />
            </button>
            {view === 'requester' && (
              <button className="primary-button" type="button">
                <Plus size={18} />
                New ticket
              </button>
            )}
          </div>
        </header>

        {view === 'overview' && (
          <>
            <section className="hero">
              <div className="hero-text">
                <span className="chip">Enterprise ready</span>
                <h2>Single workflow. Every department. Zero blind spots.</h2>
                <p>
                  Consolidate requests, enforce SLAs, and keep every team aligned—from HR onboarding to
                  critical Medicaid escalations.
                </p>
                <div className="hero-actions">
                  <button className="primary-button" type="button" onClick={() => setView('agent')}>
                    Launch agent console
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setView('requester')}>
                    View requester portal
                  </button>
                </div>
              </div>
              <div className="hero-card">
                <div className="hero-card-header">
                  <div>
                    <p className="hero-card-title">SLA risk radar</p>
                    <p className="hero-card-subtitle">Next 4 hours</p>
                  </div>
                  <CircleAlert size={20} />
                </div>
                <div className="hero-card-body">
                  <div className="risk-row">
                    <span>Medicaid Pending</span>
                    <span className="risk">5 near-breach</span>
                  </div>
                  <div className="risk-row">
                    <span>IT Service Desk</span>
                    <span className="risk">3 near-breach</span>
                  </div>
                  <div className="risk-row">
                    <span>White Gloves</span>
                    <span className="risk">1 VIP escalation</span>
                  </div>
                  <div className="risk-footer">
                    <button className="ghost-button" type="button">
                      View escalation queue
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="stats">
              {stats.map((item) => (
                <div className="stat-card" key={item.label}>
                  <p>{item.label}</p>
                  <h3>{item.value}</h3>
                  <span className={`stat-change ${item.tone}`}>{item.change}</span>
                </div>
              ))}
            </section>

            <section className="grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Queue health</h3>
                    <p>Live backlog by department</p>
                  </div>
                  <button className="ghost-button" type="button">
                    Balance load
                  </button>
                </div>
                <div className="queue-list">
                  {teams.map((team) => (
                    <div className="queue-row" key={team.name}>
                      <div>
                        <h4>{team.name}</h4>
                        <p>{team.backlog} tickets · SLA {team.sla}%</p>
                      </div>
                      <div className="queue-meta">
                        <span className={`pill ${team.priority.toLowerCase()}`}>{team.priority}</span>
                        <span className={`trend ${team.trend}`}>{team.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Automation signals</h3>
                    <p>Rules firing across channels</p>
                  </div>
                  <button className="ghost-button" type="button">
                    Tune rules
                  </button>
                </div>
                <div className="signal-grid">
                  <div className="signal-card">
                    <p>Auto-triage</p>
                    <h4>86%</h4>
                    <span>Last 24 hrs</span>
                  </div>
                  <div className="signal-card">
                    <p>Response macros</p>
                    <h4>132</h4>
                    <span>Saved replies</span>
                  </div>
                  <div className="signal-card">
                    <p>Routing confidence</p>
                    <h4>0.93</h4>
                    <span>ML score</span>
                  </div>
                  <div className="signal-card">
                    <p>Deflected</p>
                    <h4>41</h4>
                    <span>Self-serve</span>
                  </div>
                </div>
                <div className="activity">
                  {activity.map((item) => (
                    <div className="activity-row" key={item.title}>
                      <div className="activity-icon">{item.icon}</div>
                      <div>
                        <h5>{item.title}</h5>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel table-panel">
              <div className="panel-header">
                <div>
                  <h3>Priority ticket stream</h3>
                  <p>Live updates across all queues</p>
                </div>
                <button className="ghost-button" type="button">
                  Open ticket board
                </button>
              </div>
              <div className="table">
                {ticketRows.map((ticket) => (
                  <div className="table-row" key={ticket.id}>
                    <div>
                      <p className="table-id">{ticket.id}</p>
                      <h4>{ticket.subject}</h4>
                    </div>
                    <div>
                      <p className="table-label">Team</p>
                      <p>{ticket.team}</p>
                    </div>
                    <div>
                      <p className="table-label">Priority</p>
                      <span className={`pill ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                    </div>
                    <div>
                      <p className="table-label">Status</p>
                      <p>{ticket.status}</p>
                    </div>
                    <div>
                      <p className="table-label">Updated</p>
                      <p>{ticket.updated}</p>
                    </div>
                    <button className="ghost-button" type="button">
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {view === 'requester' && (
          <section className="portal-layout">
            <div className="panel form-panel">
              <div className="panel-header">
                <div>
                  <h3>Create a request</h3>
                  <p>Submit a new ticket to the right team instantly.</p>
                </div>
                <span className="badge">{currentPersona.label}</span>
              </div>
              <form className="form-grid" onSubmit={handleCreateTicket}>
                <label>
                  Subject
                  <input
                    className="input"
                    value={createForm.subject}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    className="textarea"
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    required
                  />
                </label>
                <div className="form-row">
                  <label>
                    Priority
                    <select
                      className="select"
                      value={createForm.priority}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                    >
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                      <option value="P3">P3</option>
                      <option value="P4">P4</option>
                    </select>
                  </label>
                  <label>
                    Channel
                    <select
                      className="select"
                      value={createForm.channel}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, channel: event.target.value }))
                      }
                    >
                      <option value="PORTAL">Portal</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  Submit ticket
                </button>
              </form>
              {ticketError && <p className="error-text">{ticketError}</p>}
            </div>

            <div className="panel list-panel">
              <div className="panel-header">
                <div>
                  <h3>My tickets</h3>
                  <p>Track updates and reply in one place.</p>
                </div>
                <span className="badge">{portalTickets.length} open</span>
              </div>
              <div className="ticket-list">
                {loadingTickets && <p className="muted">Loading tickets...</p>}
                {!loadingTickets && portalTickets.length === 0 && (
                  <p className="muted">No tickets yet. Create one to get started.</p>
                )}
                {portalTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={`ticket-card ${selectedTicketId === ticket.id ? 'active' : ''}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    type="button"
                  >
                    <div>
                      <h4>{ticket.subject}</h4>
                      <p>{ticket.assignedTeam?.name ?? 'Unassigned'} · {toTitle(ticket.status)}</p>
                    </div>
                    <span className={`pill ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel detail-panel">
              <div className="panel-header">
                <div>
                  <h3>Ticket details</h3>
                  <p>Conversation history and live status.</p>
                </div>
                {selectedTicket && (
                  <span className="badge">{toTitle(selectedTicket.status)}</span>
                )}
              </div>
              {loadingDetail && <p className="muted">Loading details...</p>}
              {!loadingDetail && !selectedTicket && (
                <p className="muted">Select a ticket to view the thread.</p>
              )}
              {selectedTicket && (
                <>
                  <div className="detail-meta">
                    <div>
                      <p className="table-label">Assigned team</p>
                      <p>{selectedTicket.assignedTeam?.name ?? 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="table-label">Last updated</p>
                      <p>{formatUpdated(selectedTicket.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="message-thread">
                    {selectedTicket.messages.map((message) => (
                      <div key={message.id} className={`message-bubble ${message.type === 'INTERNAL' ? 'internal' : ''}`}>
                        <div className="message-header">
                          <span>{message.author.displayName}</span>
                          <span>{formatUpdated(message.createdAt)}</span>
                        </div>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="message-composer">
                    <textarea
                      className="textarea"
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      placeholder="Write a reply..."
                    />
                    <button className="primary-button" type="button" onClick={() => handleReply()}>
                      Send reply
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {view === 'agent' && (
          <section className="portal-layout">
            <div className="panel list-panel">
              <div className="panel-header">
                <div>
                  <h3>My assignments</h3>
                  <p>Tickets currently assigned to you.</p>
                </div>
                <span className="badge">{myTickets.length} tickets</span>
              </div>
              <div className="ticket-list">
                {loadingTickets && <p className="muted">Loading tickets...</p>}
                {!loadingTickets && myTickets.length === 0 && (
                  <p className="muted">No assigned tickets yet.</p>
                )}
                {myTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={`ticket-card ${selectedTicketId === ticket.id ? 'active' : ''}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    type="button"
                  >
                    <div>
                      <h4>{ticket.subject}</h4>
                      <p>{ticket.assignedTeam?.name ?? 'Unassigned'} · {toTitle(ticket.status)}</p>
                    </div>
                    <span className={`pill ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel list-panel">
              <div className="panel-header">
                <div>
                  <h3>Unassigned queue</h3>
                  <p>Pick up new work from your team.</p>
                </div>
                <span className="badge">{unassignedTickets.length} open</span>
              </div>
              <div className="ticket-list">
                {loadingTickets && <p className="muted">Loading tickets...</p>}
                {!loadingTickets && unassignedTickets.length === 0 && (
                  <p className="muted">No unassigned tickets.</p>
                )}
                {unassignedTickets.map((ticket) => (
                  <div key={ticket.id} className="ticket-card split">
                    <button
                      className={`ticket-card-link ${selectedTicketId === ticket.id ? 'active' : ''}`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      type="button"
                    >
                      <div>
                        <h4>{ticket.subject}</h4>
                        <p>{ticket.assignedTeam?.name ?? 'Unassigned'} · {toTitle(ticket.status)}</p>
                      </div>
                    </button>
                    <button className="secondary-button" type="button" onClick={() => handleAssign(ticket.id)}>
                      Assign to me
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel detail-panel">
              <div className="panel-header">
                <div>
                  <h3>Ticket workspace</h3>
                  <p>Update status, leave internal notes, or transfer.</p>
                </div>
                {selectedTicket && (
                  <span className="badge">{toTitle(selectedTicket.status)}</span>
                )}
              </div>
              {ticketError && <p className="error-text">{ticketError}</p>}
              {loadingDetail && <p className="muted">Loading details...</p>}
              {!loadingDetail && !selectedTicket && (
                <p className="muted">Select a ticket to begin triage.</p>
              )}
              {selectedTicket && (
                <>
                  <div className="detail-meta">
                    <div>
                      <p className="table-label">Requester</p>
                      <p>{selectedTicket.requester?.displayName ?? 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="table-label">Assigned team</p>
                      <p>{selectedTicket.assignedTeam?.name ?? 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="table-label">Last updated</p>
                      <p>{formatUpdated(selectedTicket.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="action-row">
                    <select
                      className="select"
                      value={transitionStatus}
                      onChange={(event) => setTransitionStatus(event.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {toTitle(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleTransition(selectedTicket.id)}
                    >
                      Update status
                    </button>
                  </div>
                  <div className="action-row">
                    <select
                      className="select"
                      value={transferTeamId}
                      onChange={(event) => setTransferTeamId(event.target.value)}
                    >
                      <option value="">Transfer to team</option>
                      {teamsList.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleTransfer(selectedTicket.id)}
                    >
                      Transfer
                    </button>
                  </div>
                  <div className="message-thread">
                    {selectedTicket.messages.map((message) => (
                      <div key={message.id} className={`message-bubble ${message.type === 'INTERNAL' ? 'internal' : ''}`}>
                        <div className="message-header">
                          <span>{message.author.displayName}</span>
                          <span>{formatUpdated(message.createdAt)}</span>
                        </div>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="message-composer">
                    <textarea
                      className="textarea"
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      placeholder="Add an internal note or public reply..."
                    />
                    <div className="action-row">
                      <select
                        className="select"
                        value={noteType}
                        onChange={(event) => setNoteType(event.target.value)}
                      >
                        <option value="PUBLIC">Public reply</option>
                        <option value="INTERNAL">Internal note</option>
                      </select>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleReply(noteType)}
                      >
                        Send update
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {view === 'teams' && (
          <section className="admin-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Categories</h3>
                  <p>Organize tickets by category and subcategory.</p>
                </div>
                <span className="badge">{isAdmin ? 'Admin' : 'Read only'}</span>
              </div>
              <form className="form-grid" onSubmit={handleCreateCategory}>
                <label>
                  Category name
                  <input
                    className="input"
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Access & Identity"
                    required
                    disabled={!isAdmin}
                  />
                </label>
                <label>
                  Slug (optional)
                  <input
                    className="input"
                    value={categoryForm.slug}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))
                    }
                    placeholder="access-identity"
                    disabled={!isAdmin}
                  />
                </label>
                <label>
                  Description
                  <input
                    className="input"
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="SSO, VPN, permissions"
                    disabled={!isAdmin}
                  />
                </label>
                <label>
                  Parent category
                  <select
                    className="select"
                    value={categoryForm.parentId}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, parentId: event.target.value }))
                    }
                    disabled={!isAdmin}
                  >
                    <option value="">Top level</option>
                    {categories
                      .filter((category) => !category.parentId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                    disabled={!isAdmin}
                  />
                  Active immediately
                </label>
                <button className="primary-button" type="submit" disabled={!isAdmin}>
                  Save category
                </button>
                {categoryError && <p className="error-text">{categoryError}</p>}
              </form>
              {loadingCategories && <p className="muted">Loading categories...</p>}
              {!loadingCategories && categories.length === 0 && (
                <p className="muted">No categories configured yet.</p>
              )}
              <div className="rule-list">
                {categories.map((category) => (
                  <div key={category.id} className="rule-card">
                    <div>
                      <h4>{category.name}</h4>
                      <p>
                        {category.parent?.name ?? 'Top level'} · {category.slug}
                      </p>
                      {category.description && <p className="muted">{category.description}</p>}
                    </div>
                    <div className="rule-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        disabled={!isAdmin}
                      >
                        {category.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleDeleteCategory(category)}
                        disabled={!isAdmin}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Team memberships</h3>
                  <p>Assign users to teams and set their team roles.</p>
                </div>
                <span className="badge">{teamMembers.length} members</span>
              </div>
              <div className="action-row">
                <select
                  className="select"
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                >
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <form className="form-grid" onSubmit={handleAddMember}>
                <label>
                  User
                  <select
                    className="select"
                    value={memberForm.userId}
                    onChange={(event) =>
                      setMemberForm((prev) => ({ ...prev, userId: event.target.value }))
                    }
                    disabled={!isAdmin}
                  >
                    <option value="">Select user</option>
                    {usersList.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} ({user.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select
                    className="select"
                    value={memberForm.role}
                    onChange={(event) =>
                      setMemberForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    disabled={!isAdmin}
                  >
                    <option value="AGENT">Agent</option>
                    <option value="LEAD">Lead</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <button className="primary-button" type="submit" disabled={!isAdmin || !selectedTeamId}>
                  Add member
                </button>
                {memberError && <p className="error-text">{memberError}</p>}
              </form>
              {loadingMembers && <p className="muted">Loading members...</p>}
              {!loadingMembers && teamMembers.length === 0 && (
                <p className="muted">No members in this team yet.</p>
              )}
              <div className="member-list">
                {teamMembers.map((member) => (
                  <div key={member.id} className="member-card">
                    <div>
                      <h4>{member.user.displayName}</h4>
                      <p className="muted">{member.user.email}</p>
                    </div>
                    <div className="member-actions">
                      <select
                        className="select"
                        value={member.role}
                        onChange={(event) => handleUpdateMemberRole(member, event.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="AGENT">Agent</option>
                        <option value="LEAD">Lead</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        disabled={!isAdmin}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === 'routing' && (
          <section className="routing-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Routing rules</h3>
                  <p>Auto-assign tickets based on keywords and priority.</p>
                </div>
                <span className="badge">{isAdmin ? 'Admin' : 'Read only'}</span>
              </div>
              <form className="form-grid" onSubmit={handleCreateRule}>
                <label>
                  Rule name
                  <input
                    className="input"
                    value={routingForm.name}
                    onChange={(event) => setRoutingForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="HR onboarding keywords"
                    required
                    disabled={!isAdmin}
                  />
                </label>
                <label>
                  Keywords (comma separated)
                  <input
                    className="input"
                    value={routingForm.keywords}
                    onChange={(event) =>
                      setRoutingForm((prev) => ({ ...prev, keywords: event.target.value }))
                    }
                    placeholder="onboard, benefits, hr"
                    required
                    disabled={!isAdmin}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Team
                    <select
                      className="select"
                      value={routingForm.teamId}
                      onChange={(event) => setRoutingForm((prev) => ({ ...prev, teamId: event.target.value }))}
                      required
                      disabled={!isAdmin}
                    >
                      <option value="">Select team</option>
                      {teamsList.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={999}
                      value={routingForm.priority}
                      onChange={(event) =>
                        setRoutingForm((prev) => ({ ...prev, priority: Number(event.target.value) }))
                      }
                      disabled={!isAdmin}
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={routingForm.isActive}
                    onChange={(event) =>
                      setRoutingForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                    disabled={!isAdmin}
                  />
                  Active immediately
                </label>
                <button className="primary-button" type="submit" disabled={!isAdmin}>
                  Save rule
                </button>
                {routingError && <p className="error-text">{routingError}</p>}
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Active rules</h3>
                  <p>Ordered by priority (lower number first).</p>
                </div>
                <span className="badge">{routingRules.length} rules</span>
              </div>
              {loadingRouting && <p className="muted">Loading routing rules...</p>}
              {!loadingRouting && routingRules.length === 0 && (
                <p className="muted">No routing rules configured yet.</p>
              )}
              <div className="rule-list">
                {routingRules.map((rule) => (
                  <div key={rule.id} className="rule-card">
                    <div>
                      <h4>{rule.name}</h4>
                      <p>
                        {rule.team?.name ?? 'Unassigned'} · Priority {rule.priority}
                      </p>
                      <div className="tag-row">
                        {rule.keywords.map((keyword) => (
                          <span key={keyword} className="tag">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rule-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleToggleRule(rule)}
                        disabled={!isAdmin}
                      >
                        {rule.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleDeleteRule(rule)}
                        disabled={!isAdmin}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
