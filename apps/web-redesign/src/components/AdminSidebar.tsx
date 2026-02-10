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
  route: AdminRoute;
  icon: LucideIcon;
  roles: Role[];
};

const adminItems: AdminSidebarItem[] = [
  {
    key: 'sla-settings',
    label: 'SLA Policies',
    route: '/sla-settings',
    icon: Shield,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'routing',
    label: 'Routing Rules',
    route: '/routing',
    icon: ArrowRightLeft,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'automation',
    label: 'Automation Rules',
    route: '/automation',
    icon: Bot,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'custom-fields',
    label: 'Custom Fields',
    route: '/custom-fields',
    icon: Wrench,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'audit-log',
    label: 'Audit Logs',
    route: '/audit-log',
    icon: FileText,
    roles: ['TEAM_ADMIN', 'OWNER']
  },
  {
    key: 'categories',
    label: 'Categories',
    route: '/categories',
    icon: Tags,
    roles: ['OWNER']
  },
  {
    key: 'reports',
    label: 'Reports',
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
  onNavigate,
  className
}: {
  visible: boolean;
  role: Role;
  pathname: string;
  onBack: () => void;
  onNavigate: (route: AdminRoute) => void;
  className?: string;
}) {
  const items = adminItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`glass-card-strong fixed left-0 top-0 z-50 h-screen w-64 p-5 transition-transform duration-300 ease-out ${
        visible ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      } ${className ?? ''}`}
      aria-hidden={!visible}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200/60 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white flex items-center justify-center font-semibold">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
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
                className={`relative w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-slate-100 text-slate-900 shadow-soft' : 'text-slate-700 hover:bg-slate-100/80'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-600"
                    aria-hidden
                  />
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-900'}`}>
                      {item.label}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/60 pt-4" />
      </div>
    </aside>
  );
}
