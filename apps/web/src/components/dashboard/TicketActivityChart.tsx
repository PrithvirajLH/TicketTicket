import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type ActivityPoint = {
  day: string;
  date: string;
  open: number;
  resolved: number;
};

export function TicketActivityChart({ data }: { data: ActivityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No activity data available.
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="openGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--status-progress))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--status-progress))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--status-resolved))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--status-resolved))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
            formatter={(value: number) => [value, 'Tickets']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-card)',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="open"
            stroke="hsl(var(--status-progress))"
            strokeWidth={2}
            fill="url(#openGradient)"
            dot={{ fill: 'hsl(var(--status-progress))', strokeWidth: 0, r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="resolved"
            stroke="hsl(var(--status-resolved))"
            strokeWidth={2}
            fill="url(#resolvedGradient)"
            dot={{ fill: 'hsl(var(--status-resolved))', strokeWidth: 0, r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
