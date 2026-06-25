"use client";

import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Datum {
  name: string;
  value: number;
}

interface ChartsProps {
  useCases: Datum[];
  budgets: Datum[];
  models: Datum[];
  statuses: Datum[];
}

const BRAND = "#4f46e5";
const PALETTE = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899"];

const AXIS_STYLE = { fontSize: 12, fill: "var(--color-muted)" } as const;
const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 10,
  fontSize: 13,
  color: "var(--color-ink)",
} as const;

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactElement;
}) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-base font-bold text-[var(--color-ink)]">{title}</h3>
      {empty ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-[var(--color-muted)]">
          لا توجد بيانات كافية بعد
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

// Pie slice label: "name: value". Typed loosely to match recharts' render props.
function renderPieLabel(props: { name?: string | number; value?: string | number }): string {
  return `${props.name}: ${props.value}`;
}

// Client component: admin analytics charts (RTL-aware).
export function Charts({ useCases, budgets, models, statuses }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="الاستخدامات الأكثر طلباً" empty={useCases.length === 0}>
        <BarChart data={useCases} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis dataKey="name" tick={AXIS_STYLE} interval={0} angle={-15} textAnchor="end" height={56} />
          <YAxis allowDecimals={false} tick={AXIS_STYLE} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,0.08)" }} />
          <Bar dataKey="value" fill={BRAND} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="توزيع حالات الجلسات" empty={statuses.length === 0}>
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={statuses}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={48}
            paddingAngle={2}
            label={renderPieLabel}
            labelLine={false}
          >
            {statuses.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartCard>

      <ChartCard title="توزيع الميزانيات" empty={budgets.length === 0}>
        <BarChart data={budgets} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis dataKey="name" tick={AXIS_STYLE} interval={0} height={40} />
          <YAxis allowDecimals={false} tick={AXIS_STYLE} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,0.08)" }} />
          <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="الأجهزة الأكثر ترشيحاً" empty={models.length === 0}>
        <BarChart
          data={models}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_STYLE}
            width={140}
            interval={0}
            orientation="right"
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,0.08)" }} />
          <Bar dataKey="value" fill="#22c55e" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  );
}
