'use client';

import Link from 'next/link';
import type { DashboardForm } from '@/types/dashboard';

interface PopularFormsProps {
  forms: DashboardForm[];
}

/* Tiny SVG sparkline — a simple bezier curve in mint */
function Sparkline() {
  return (
    <svg width="56" height="24" viewBox="0 0 56 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 18 C10 14, 14 20, 20 12 C26 4, 30 16, 36 10 C42 4, 46 14, 54 6"
        stroke="#91e0da"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function PopularForms({ forms }: PopularFormsProps) {
  const sorted = [...forms].sort((a, b) => b.responses - a.responses).slice(0, 5);

  return (
    <div className="hub-card p-5" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
          Popular forms
        </h3>
        <Link href="/dashboard" className="text-xs font-bold text-[#6c8289] transition hover:text-[#124741]">
          View all
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#6c8289]">No forms to show.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((form, i) => (
            <li key={form.id} className="flex items-center gap-3">
              {/* Rank */}
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black"
                style={{ background: 'rgba(145,224,218,0.2)', color: '#124741' }}
              >
                {i + 1}
              </span>

              {/* Name + responses */}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/forms/${form.id}`}
                  className="block truncate text-sm font-bold text-[#124741] hover:underline"
                >
                  {form.title}
                </Link>
                <p className="text-xs text-[#6c8289]">
                  {form.responses} response{form.responses !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Sparkline */}
              <Sparkline />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
