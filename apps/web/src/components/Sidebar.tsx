import { ChevronLeft, ChevronRight, Plus, type LucideIcon } from 'lucide-react';
import type { Role } from '../types';

export type SidebarItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export function Sidebar({
  collapsed,
  onToggle,
  items,
  activeKey,
  onSelect,
  currentRole,
  onCreateTicket
}: {
  collapsed: boolean;
  onToggle: () => void;
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  currentRole: Role;
  onCreateTicket?: () => void;
}) {
  return (
    <aside
      className={`glass-card-strong fixed left-0 top-0 h-screen p-5 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200/60">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white flex items-center justify-center font-semibold">
          T
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold text-slate-900">CSNHC</p>
            <p className="text-xs text-slate-600">Service Desk</p>
          </div>
        )}
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        {items.map((item) => {
          const isActive = activeKey === item.key;
          const Icon = item.icon;
          const label = item.key === 'created' && currentRole === 'EMPLOYEE' ? 'My Tickets' : item.label;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive ? 'bg-slate-900 text-white shadow-soft' : 'text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <span className="flex-shrink-0">
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
              </span>
              {!collapsed && (
                <span className="flex-1 text-left truncate flex items-center gap-2">
                  {label}
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`flex-shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                        isActive ? 'bg-white/90 text-slate-900' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {onCreateTicket && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onCreateTicket}
            className={`w-full inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-slate-800 transition ${collapsed ? 'justify-center' : ''}`}
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>New Ticket</span>}
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-slate-200/60 pt-4 flex items-center justify-between">
        {!collapsed && <span className="text-xs text-slate-600">Secure internal system</span>}
        <button
          type="button"
          onClick={onToggle}
          className="h-8 w-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
