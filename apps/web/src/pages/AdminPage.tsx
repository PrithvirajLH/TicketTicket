import { Link } from 'react-router-dom';
import { Clock, GitMerge, Layers, ListChecks } from 'lucide-react';

const adminCards = [
  {
    title: 'SLA Settings',
    description: 'Configure first response and resolution targets per team.',
    href: '/sla-settings',
    icon: Clock
  },
  {
    title: 'Routing Rules',
    description: 'Control keyword-based auto-routing for new tickets.',
    href: '/routing',
    icon: GitMerge
  },
  {
    title: 'Categories',
    description: 'Manage ticket categories and subcategories.',
    href: '/categories',
    icon: Layers
  },
  {
    title: 'Custom Fields',
    description: 'Define custom fields per team for tickets.',
    href: '/custom-fields',
    icon: ListChecks
  }
];

export function AdminPage() {
  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-slate-900">Admin</h3>
        <p className="text-sm text-slate-500">System configuration and governance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.href}
              className="glass-card p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{card.description}</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
