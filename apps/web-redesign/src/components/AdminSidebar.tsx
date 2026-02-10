import {
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  Bot,
  FileText,
  Shield,
  Tags,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import type { Role } from '../types';

type AdminRoute =
  | '/sla-settings'
  | '/routing'
  | '/automation'
  | '/custom-fields'
  | '/audit-log'
  | '/categories'
  | '/reports';

type AdminSidebarItem = {
  key:
    | 'sla-settings'
    | 'routing'
    | 'automation'
    | 'custom-fields'
    | 'audit-log'
    | 'categories'
    | 'reports';
  label: string;
  description: string;
  route: AdminRoute;
  icon: LucideIcon;
  roles: Role[];
};

const adminItems: AdminSidebarItem[] = [
  {
    key: 'sla-settings',
    label: 'SLA Policies',
    description: 'Targets, business hours, escalation',
    route: '/sla-settings',
    icon: Shield,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'routing',
    label: 'Routing Rules',
    description: 'Auto-assign teams and priority',
    route: '/routing',
    icon: ArrowRightLeft,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'automation',
    label: 'Automation Rules',
    description: 'Triggers, conditions, actions',
    route: '/automation',
    icon: Bot,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'custom-fields',
    label: 'Custom Fields',
    description: 'Form fields and visibility',
    route: '/custom-fields',
    icon: Wrench,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'audit-log',
    label: 'Audit Logs',
    description: 'Track changes and activity',
    route: '/audit-log',
    icon: FileText,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Manage ticket taxonomy',
    route: '/categories',
    icon: Tags,
    roles: ['OWNER']
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Analytics and insights',
    route: '/reports',
    icon: BarChart3,
    roles: ['TEAM_ADMIN', 'OWNER']
  }
];

function isItemActive(route: AdminRoute, pathname: string): boolean {
  if (route === '/sla-settings') return pathname.startsWith('/sla-settings');
  if (route === '/routing') return pathname.startsWith('/routing');
  if (route === '/automation') return pathname.startsWith('/automation');
  if (route === '/custom-fields') return pathname.startsWith('/custom-fields');
  if (route === '/audit-log') return pathname.startsWith('/audit-log');
  if (route === '/reports') return pathname.startsWith('/reports');
  return pathname.startsWith('/categories');
}

export function AdminSidebar({
  visible,
  role,
  pathname,
  onBack,
  onNavigate
}: {
  visible: boolean;
  role: Role;
  pathname: string;
  onBack: () => void;
  onNavigate: (route: AdminRoute) => void;
}) {
  const items = adminItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`glass-card-strong fixed left-0 top-0 z-50 h-screen w-64 p-5 transition-transform duration-300 ease-out ${
        visible ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200/60 pb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Configuration
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Workspace Settings</p>
          <p className="mt-0.5 text-xs text-slate-500">Manage policies, rules, and governance</p>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.route, pathname);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.route)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'text-slate-700 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-900'}`}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/60 pt-4">
          <p className="text-sm font-semibold text-slate-800">Governance</p>
          <p className="mt-0.5 text-xs text-slate-500">Changes are tracked in Audit Logs.</p>
        </div>
      </div>
    </aside>
  );
}
