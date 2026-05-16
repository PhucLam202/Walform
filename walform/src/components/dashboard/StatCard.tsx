'use client';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: string;
  trendPositive?: boolean;
}

export function StatCard({ icon, label, value, trend, trendPositive }: StatCardProps) {
  return (
    <article
      className="hub-card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* Icon */}
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#6c8289]" style={{ fontWeight: 600 }}>
          {label}
        </p>
        <h3
          className="mt-0.5 text-3xl leading-none text-[#124741]"
          style={{ fontWeight: 900, letterSpacing: '-0.04em' }}
        >
          {value}
        </h3>
        {trend && (
          <p
            className="mt-1 text-xs font-bold"
            style={{ color: trendPositive === false ? '#b91c1c' : '#2a9d8f' }}
          >
            {trendPositive === true ? '↑' : trendPositive === false ? '↓' : '→'} {trend}
          </p>
        )}
      </div>
    </article>
  );
}
