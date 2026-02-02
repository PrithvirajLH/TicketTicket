import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type SlaData = { met: number; breached: number; total: number };

const COLORS = { met: '#16a34a', breached: '#dc2626' };

export function SlaComplianceChart({ data }: { data: SlaData }) {
  const points = [
    { name: 'Met', value: data.met, color: COLORS.met },
    { name: 'Breached', value: data.breached, color: COLORS.breached },
  ].filter((p) => p.value > 0);
  if (points.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-slate-500">
        No SLA data in range
      </div>
    );
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={points}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {points.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [value, 'Tickets']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
