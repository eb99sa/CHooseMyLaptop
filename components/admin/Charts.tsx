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
  locationSources: Datum[];
}

// Grayscale ramp for multi-slice pies (recharts Cell fill wants a concrete
// color). EMO is achromatic: distinct light grays read as slices on the charcoal
// card. Single-series bars use the ink token directly (bone white on charcoal).
const GRAYSCALE = ["#ffffff", "#c9c9c9", "#9d9d9d", "#e4e4e4", "#808080", "#b5b5b5"];
const INK_FILL = "var(--color-ink)";
// Hover cursor — bone at very low alpha (var() is unreliable inside the cursor rect).
const CURSOR_FILL = "rgba(255,255,255,0.06)";

const AXIS_STYLE = { fontSize: 12, fill: "var(--color-muted)" } as const;
const tooltipStyle = {
  background: "var(--color-surface-solid)",
  border: "1px solid var(--color-line-strong)",
  borderRadius: 10,
  fontSize: 13,
  color: "var(--color-ink)",
} as const;

// Visually-hidden data table so screen-reader users get the chart's Datum[].
function SrDataTable({ caption, data }: { caption: string; data: Datum[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">البند</th>
          <th scope="col">العدد</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={i}>
            <th scope="row">{d.name}</th>
            <td>
              <span dir="ltr">{d.value}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartCard({
  title,
  ariaLabel,
  data,
  empty,
  children,
}: {
  title: string;
  ariaLabel: string;
  data: Datum[];
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
        <>
          {/* Sibling of role="img" (not a child): role="img" flattens its
             subtree, so a nested table would be hidden from screen readers. */}
          <SrDataTable caption={ariaLabel} data={data} />
          <div role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height={260}>
              {children}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// Pie slice label: "name: value". Typed loosely to match recharts' render props.
function renderPieLabel(props: { name?: string | number; value?: string | number }): string {
  return `${props.name}: ${props.value}`;
}

// Client component: admin analytics charts (RTL-aware).
export function Charts({ useCases, budgets, models, statuses, locationSources }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="الاستخدامات الأكثر طلباً"
        ariaLabel="رسم بياني: الاستخدامات الأكثر طلباً"
        data={useCases}
        empty={useCases.length === 0}
      >
        <BarChart data={useCases} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis dataKey="name" tick={AXIS_STYLE} interval={0} angle={-15} textAnchor="end" height={56} />
          <YAxis allowDecimals={false} tick={AXIS_STYLE} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="value" fill={INK_FILL} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="توزيع حالات الجلسات"
        ariaLabel="رسم بياني: توزيع حالات الجلسات"
        data={statuses}
        empty={statuses.length === 0}
      >
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
              <Cell key={i} fill={GRAYSCALE[i % GRAYSCALE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartCard>

      <ChartCard
        title="توزيع الميزانيات"
        ariaLabel="رسم بياني: توزيع الميزانيات"
        data={budgets}
        empty={budgets.length === 0}
      >
        <BarChart data={budgets} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis dataKey="name" tick={AXIS_STYLE} interval={0} height={40} />
          <YAxis allowDecimals={false} tick={AXIS_STYLE} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="value" fill={INK_FILL} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="الأجهزة الأكثر ترشيحاً"
        ariaLabel="رسم بياني: الأجهزة الأكثر ترشيحاً"
        data={models}
        empty={models.length === 0}
      >
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
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="value" fill={INK_FILL} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="مصدر تحديد الموقع"
        ariaLabel="رسم بياني: مصدر تحديد الموقع"
        data={locationSources}
        empty={locationSources.length === 0}
      >
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={locationSources}
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
            {locationSources.map((_, i) => (
              <Cell key={i} fill={GRAYSCALE[i % GRAYSCALE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartCard>
    </div>
  );
}
