'use client';

import Link from 'next/link';
import { Plus, LayoutTemplate } from 'lucide-react';

export function DashboardHero() {
  return (
    <section
      className="relative overflow-hidden rounded-[20px] p-8 md:p-12"
      style={{
        background: 'linear-gradient(135deg, #eef8f4 0%, #d4f5ef 50%, #c2ede7 100%)',
        border: '1px solid rgba(145,224,218,0.45)',
      }}
    >
      {/* Decorative blobs */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1
            className="text-5xl leading-none text-[#124741] md:text-6xl"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 700,
              letterSpacing: '-0.055em',
            }}
          >
            Welcome back
          </h1>
          <p
            className="mt-3 text-2xl text-[#124741]"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
            }}
          >
            Manage your forms, submissions, and on-chain activity
          </p>
          <p
            className="mt-4 max-w-xl leading-7 text-[#314e50]"
            style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}
          >
            Create forms, collect responses, and track your on-chain activity all from your WalForm
            dashboard.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 rounded-[14px] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
            style={{ background: '#124741', fontFamily: 'var(--font-ui)' }}
          >
            <Plus className="size-4" />
            Create new form
          </Link>
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(145,224,218,0.6)] bg-white/70 px-5 py-3 text-sm font-bold text-[#124741] backdrop-blur-sm transition hover:bg-white"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <LayoutTemplate className="size-4" />
            View templates
          </Link>
        </div>
      </div>
    </section>
  );
}
