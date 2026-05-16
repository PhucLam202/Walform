'use client';

import { useMemo, useState } from 'react';

interface ResponseChartProps {
  timestamps: number[];
  isLoading?: boolean;
}

type Period = 1 | 7 | 30;
type ChartType = 'line' | 'donut';

const PERIODS: { value: Period; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'donut', label: 'Donut' },
];

function buildData(timestamps: number[], days: Period) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const label =
      days === 1
        ? d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    const responses = timestamps.filter(
      (ts) => ts >= dayStart.getTime() && ts <= dayEnd.getTime(),
    ).length;
    return { day: label, responses };
  });
}

function niceScale(rawMax: number): { max: number; ticks: number[] } {
  if (rawMax <= 0) return { max: 4, ticks: [4, 3, 2, 1, 0] };
  const steps = 4;
  let step = Math.ceil(rawMax / steps);
  if (step > 5) step = Math.ceil(step / 5) * 5;
  const max = step * steps;
  const ticks: number[] = [];
  for (let i = steps; i >= 0; i--) ticks.push(i * step);
  return { max, ticks };
}

// ── Line chart ───────────────────────────────────────────────
function EmptyChart({ period, onExpandRange }: { period: Period; onExpandRange?: () => void }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
      <svg viewBox="0 0 48 48" className="h-10 w-10 opacity-30">
        <polyline
          points="4,40 16,28 24,34 36,16 44,22"
          fill="none"
          stroke="#5cc8c0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-xs font-bold text-[#6c8289]">No responses in this period</p>
      {period < 30 && onExpandRange ? (
        <button
          type="button"
          onClick={onExpandRange}
          className="mt-1 rounded-full px-3 py-1 text-[11px] font-bold text-[#124741] transition hover:bg-[rgba(145,224,218,0.2)]"
          style={{ border: '1px solid rgba(145,224,218,0.5)' }}
        >
          View 30 days →
        </button>
      ) : (
        <p className="text-[11px] text-[#aabfc4]">No submissions recorded yet</p>
      )}
    </div>
  );
}

function LineChart({ data, period, onExpandRange }: { data: { day: string; responses: number }[]; period: Period; onExpandRange?: () => void }) {
  const total = data.reduce((s, d) => s + d.responses, 0);
  const rawMax = Math.max(...data.map((d) => d.responses), 1);
  const { max, ticks } = niceScale(rawMax);

  const W = 420;
  const H = 120;
  const PAD = 8;
  const n = data.length;

  const x = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const points = data.map((d, i) => ({ sx: x(i), sy: y(d.responses), v: d.responses }));
  const polyline = points.map((p) => `${p.sx},${p.sy}`).join(' ');
  const areaPath = [
    `M ${points[0].sx} ${H - PAD}`,
    ...points.map((p) => `L ${p.sx} ${p.sy}`),
    `L ${points[points.length - 1].sx} ${H - PAD}`,
    'Z',
  ].join(' ');

  const labelEvery = period === 30 ? 5 : 1;

  if (total === 0) return <EmptyChart period={period} onExpandRange={onExpandRange} />;

  return (
    <div className="flex gap-3">
      <div className="flex w-6 flex-col justify-between text-right" style={{ paddingBottom: '1.25rem' }}>
        {ticks.map((v) => (
          <span key={v} className="text-[10px] leading-none text-[#6c8289]">{v}</span>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible">
          {ticks.slice(0, -1).map((v) => (
            <line
              key={v}
              x1={PAD} x2={W - PAD}
              y1={y(v)} y2={y(v)}
              stroke="rgba(108,130,137,0.12)"
              strokeWidth="1"
            />
          ))}
          <path d={areaPath} fill="rgba(145,224,218,0.15)" />
          <polyline
            points={polyline}
            fill="none"
            stroke="#5cc8c0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
        <div className="flex gap-1.5">
          {data.map((point, i) => (
            <div key={point.day} className="flex flex-1 justify-center">
              <span className="text-[10px] text-[#6c8289]">
                {i % labelEvery === 0 ? point.day : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────
const DONUT_COLORS = [
  '#5cc8c0', '#91e0da', '#124741', '#2d8a84', '#a8ede9',
  '#3cb8b0', '#6fd4ce', '#0e5e59', '#b8f0ec', '#1a7a74',
];

function DonutChart({ data, period, onExpandRange }: { data: { day: string; responses: number }[]; period: Period; onExpandRange?: () => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.responses, 0);

  const R = 60;
  const CX = 90;
  const CY = 80;
  const stroke = 22;

  const nonEmpty = data.filter((d) => d.responses > 0);
  const isSingle = nonEmpty.length === 1;

  let cumAngle = -Math.PI / 2;
  const slices = nonEmpty.map((d, i) => {
    const pct = d.responses / Math.max(total, 1);
    const startAngle = cumAngle;
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
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      label: d.day,
      value: d.responses,
      pct,
    };
  });

  if (total === 0) return <EmptyChart period={period} onExpandRange={onExpandRange} />;

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-2 sm:flex-row sm:gap-10">
      <svg viewBox={`0 0 ${CX * 2} ${CY * 2 + 4}`} className="h-40 w-40 shrink-0">
        {slices.map((s, i) => (
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
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#124741">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="#6c8289">responses</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex cursor-pointer items-center gap-1.5 transition-opacity"
            style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-[#314e50]">{s.label}</span>
            <span className="text-xs font-bold text-[#124741]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="flex h-44 animate-pulse flex-col gap-3">
      <div className="flex flex-1 items-end gap-1.5 px-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${20 + Math.random() * 60}%`,
              background: 'rgba(145,224,218,0.2)',
            }}
          />
        ))}
      </div>
      <div className="flex gap-1.5 px-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-2 flex-1 rounded" style={{ background: 'rgba(108,130,137,0.12)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function ResponseChart({ timestamps, isLoading }: ResponseChartProps) {
  const [period, setPeriod] = useState<Period>(30);
  const [chartType, setChartType] = useState<ChartType>('line');

  const data = useMemo(() => buildData(timestamps, period), [timestamps, period]);
  const total = data.reduce((s, d) => s + d.responses, 0);

  return (
    <div className="hub-card p-6" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
            Responses
          </h3>
          {!isLoading && (
            <p className="mt-0.5 text-xs text-[#6c8289]">
              {total} response{total !== 1 ? 's' : ''} in the last{' '}
              {period === 1 ? 'day' : `${period} days`}
            </p>
          )}
        </div>

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

          {/* Period switcher */}
          <div
            className="flex gap-0.5 rounded-xl p-0.5"
            style={{ background: 'rgba(108,130,137,0.1)' }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all"
                style={
                  period === p.value
                    ? { background: '#fff', color: '#124741', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#6c8289' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <ChartSkeleton />
      ) : chartType === 'line' ? (
        <LineChart data={data} period={period} onExpandRange={period < 30 ? () => setPeriod(30) : undefined} />
      ) : (
        <DonutChart data={data} period={period} onExpandRange={period < 30 ? () => setPeriod(30) : undefined} />
      )}
    </div>
  );
}
