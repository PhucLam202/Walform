'use client';

import { useState } from 'react';
import type { ChartDataPoint } from '@/types/dashboard';

interface ResponseChartProps {
  data: ChartDataPoint[];
}

type ChartType = 'bar' | 'line' | 'donut';

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'donut', label: 'Donut' },
];

// Returns integer tick values with no floating point issues
function niceScale(rawMax: number): { max: number; ticks: number[] } {
  if (rawMax <= 0) return { max: 4, ticks: [4, 3, 2, 1, 0] };
  // Find a step that divides into 4 clean integer ticks
  const steps = 4;
  let step = Math.ceil(rawMax / steps);
  // Round step up to nearest "nice" number
  if (step > 5) step = Math.ceil(step / 5) * 5;
  const max = step * steps;
  const ticks: number[] = [];
  for (let i = steps; i >= 0; i--) ticks.push(i * step);
  return { max, ticks };
}

// ── Bar chart ────────────────────────────────────────────────
function BarChart({ data }: { data: ChartDataPoint[] }) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.responses, 0);
  const rawMax = Math.max(...data.map((d) => d.responses), 1);
  const { max, ticks } = niceScale(rawMax);

  return (
    <div className="flex gap-3">
      {/* Y-axis */}
      <div className="flex w-6 flex-col justify-between pb-5 text-right">
        {ticks.map((v) => (
          <span key={v} className="text-[10px] leading-none text-[#6c8289]">{v}</span>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {/* Empty state */}
        {total === 0 && (
          <div className="flex h-36 items-center justify-center text-xs text-[#6c8289]">
            No responses in the last 7 days
          </div>
        )}

        {/* Bar area */}
        {total > 0 && <div className="relative flex h-36 items-end gap-1.5">
          {/* Grid lines */}
          {ticks.slice(0, -1).map((v) => (
            <div
              key={v}
              className="pointer-events-none absolute left-0 right-0 border-t"
              style={{ bottom: `${(v / max) * 100}%`, borderColor: 'rgba(108,130,137,0.12)' }}
            />
          ))}

          {data.map((point) => {
            const heightPct = (point.responses / max) * 100;
            const isHovered = hoveredDay === point.day;
            return (
              <div
                key={point.day}
                className="relative flex flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHoveredDay(point.day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {isHovered && point.responses > 0 && (
                  <span
                    className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: '#124741' }}
                  >
                    {point.responses}
                  </span>
                )}
                <div
                  className="w-full rounded-t-md transition-all duration-150"
                  style={{
                    height: `${Math.max(heightPct, 3)}%`,
                    background: heightPct > 0
                      ? isHovered
                        ? 'linear-gradient(180deg, #5cc8c0 0%, #3aada5 100%)'
                        : 'linear-gradient(180deg, #91e0da 0%, #5cc8c0 100%)'
                      : 'rgba(145,224,218,0.18)',
                  }}
                />
              </div>
            );
          })}
        </div>}

        {/* X-axis labels */}
        <div className="flex gap-1.5">
          {data.map((point) => (
            <div key={point.day} className="flex flex-1 justify-center">
              <span className="text-[10px] text-[#6c8289]">{point.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Line chart ───────────────────────────────────────────────
function LineChart({ data }: { data: ChartDataPoint[] }) {
  const rawMax = Math.max(...data.map((d) => d.responses), 1);
  const { max, ticks } = niceScale(rawMax);

  const W = 420;
  const H = 120;
  const PAD = 8;
  const n = data.length;

  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const points = data.map((d, i) => ({ sx: x(i), sy: y(d.responses), v: d.responses }));
  const polyline = points.map((p) => `${p.sx},${p.sy}`).join(' ');

  // Area fill path
  const areaPath = [
    `M ${points[0].sx} ${H - PAD}`,
    ...points.map((p) => `L ${p.sx} ${p.sy}`),
    `L ${points[points.length - 1].sx} ${H - PAD}`,
    'Z',
  ].join(' ');

  return (
    <div className="flex gap-3">
      {/* Y-axis */}
      <div className="flex w-6 flex-col justify-between text-right" style={{ paddingBottom: '1.25rem' }}>
        {ticks.map((v) => (
          <span key={v} className="text-[10px] leading-none text-[#6c8289]">{v}</span>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible">
          {/* Grid lines */}
          {ticks.slice(0, -1).map((v) => (
            <line
              key={v}
              x1={PAD} x2={W - PAD}
              y1={y(v)} y2={y(v)}
              stroke="rgba(108,130,137,0.12)"
              strokeWidth="1"
            />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="rgba(145,224,218,0.15)" />
          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#5cc8c0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dots + tooltips */}
          {points.map((p, i) => (
            <g key={data[i].day} className="group">
              <circle cx={p.sx} cy={p.sy} r="4" fill="#5cc8c0" stroke="white" strokeWidth="2" />
              {p.v > 0 && (
                <text
                  x={p.sx}
                  y={p.sy - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#124741"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {p.v}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex gap-1.5">
          {data.map((point) => (
            <div key={point.day} className="flex flex-1 justify-center">
              <span className="text-[10px] text-[#6c8289]">{point.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────
function DonutChart({ data }: { data: ChartDataPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.responses, 0);

  const COLORS = [
    '#5cc8c0', '#91e0da', '#124741', '#2d8a84', '#a8ede9',
    '#3cb8b0', '#6fd4ce', '#0e5e59', '#b8f0ec', '#1a7a74',
  ];

  const R = 60;
  const CX = 90;
  const CY = 80;
  const stroke = 22;

  const nonEmpty = data.filter((d) => d.responses > 0);
  const isEmpty = total === 0;
  const isSingle = nonEmpty.length === 1;

  // Build arcs — when pct=1 (single slice), SVG arc degenerates; use circle instead
  let cumAngle = -Math.PI / 2;
  const slices = nonEmpty.map((d, i) => {
    const pct = d.responses / Math.max(total, 1);
    const startAngle = cumAngle;
    // Leave a tiny 0.5° gap so the arc is always renderable
    const sweep = isSingle ? 2 * Math.PI - 0.001 : pct * 2 * Math.PI;
    const endAngle = cumAngle + sweep;
    cumAngle += pct * 2 * Math.PI;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      color: COLORS[i % COLORS.length],
      label: d.day,
      value: d.responses,
      pct,
    };
  });

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-2 sm:flex-row sm:gap-10">
      {/* SVG */}
      <svg viewBox={`0 0 ${CX * 2} ${CY * 2 + 4}`} className="h-40 w-40 shrink-0">
        {isEmpty ? (
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(145,224,218,0.25)" strokeWidth={stroke} />
        ) : (
          slices.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={s.color}
              strokeWidth={hovered === i ? stroke + 4 : stroke}
              strokeLinecap="butt"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))
        )}
        {/* Center label */}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#124741">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="#6c8289">responses</text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {isEmpty ? (
          <p className="text-xs text-[#6c8289]">No responses yet.</p>
        ) : (
          slices.map((s, i) => (
            <div
              key={i}
              className="flex cursor-pointer items-center gap-1.5 transition-opacity"
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-[#314e50]">{s.label}</span>
              <span className="text-xs font-bold text-[#124741]">{s.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function ResponseChart({ data }: ResponseChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');

  return (
    <div className="hub-card p-6" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
          Responses in last 7 days
        </h3>
        <div className="flex items-center gap-2">
          {/* Chart type switcher */}
          <div
            className="flex gap-0.5 rounded-xl p-0.5"
            style={{ background: 'rgba(108,130,137,0.1)' }}
          >
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => setChartType(ct.id)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all"
                style={
                  chartType === ct.id
                    ? { background: '#fff', color: '#124741', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#6c8289' }
                }
              >
                {ct.label}
              </button>
            ))}
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}
          >
            Last 7 days
          </span>
        </div>
      </div>

      {/* Chart */}
      {chartType === 'bar' && <BarChart data={data} />}
      {chartType === 'line' && <LineChart data={data} />}
      {chartType === 'donut' && <DonutChart data={data} />}
    </div>
  );
}
