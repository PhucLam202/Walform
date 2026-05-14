'use client';

import { useMemo, useState } from 'react';

interface ResponseChartProps {
  timestamps: number[];
}

type Period = 1 | 7 | 30;

const PERIODS: { value: Period; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
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

function LineChart({ data, period }: { data: { day: string; responses: number }[]; period: Period }) {
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

  // Show every Nth label to avoid crowding
  const labelEvery = period === 30 ? 5 : period === 7 ? 1 : 1;

  return (
    <div>
      {total === 0 ? (
        <div className="flex h-36 items-center justify-center text-xs text-[#6c8289]">
          No responses in this period
        </div>
      ) : (
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
      )}
    </div>
  );
}

export function ResponseChart({ timestamps }: ResponseChartProps) {
  const [period, setPeriod] = useState<Period>(7);

  const data = useMemo(() => buildData(timestamps, period), [timestamps, period]);
  const total = data.reduce((s, d) => s + d.responses, 0);

  return (
    <div className="hub-card p-6" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
            Responses
          </h3>
          <p className="text-xs text-[#6c8289] mt-0.5">
            {total} response{total !== 1 ? 's' : ''} in the last {period === 1 ? 'day' : `${period} days`}
          </p>
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

      <LineChart data={data} period={period} />
    </div>
  );
}
