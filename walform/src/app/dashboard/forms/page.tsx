'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useOwnedForms } from '@/hooks/useForms';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { WalletGuard } from '@/components/shared/WalletGuard';
import { AppFooter } from '@/components/shared/AppFooter';
import { Skeleton } from '@/components/ui/skeleton';
import { SUI_NETWORK } from '@/lib/constants';
import {
  FileText,
  MoreHorizontal,
  ExternalLink,
  Copy,
  ArrowLeft,
  Plus,
  Search,
  BarChart3,
  ChevronRight,
  LayoutGrid,
  List,
  Link2,
} from 'lucide-react';
import type { DashboardFormStatus } from '@/types/dashboard';

type StatusFilter = 'All' | DashboardFormStatus;
type ViewMode = 'list' | 'grid';

/* ─── Status pill ─────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: DashboardFormStatus }) {
  const cfg: Record<DashboardFormStatus, { bg: string; dot: string; color: string }> = {
    Active: { bg: 'rgba(145,224,218,0.22)', dot: '#15a080', color: '#124741' },
    Draft:  { bg: 'rgba(108,130,137,0.12)', dot: '#6c8289',  color: '#6c8289' },
    Closed: { bg: 'rgba(239,68,68,0.10)',   dot: '#ef4444',  color: '#b91c1c' },
  };
  const c = cfg[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

/* ─── Three-dot menu ──────────────────────────────────────────────────────── */
function ThreeDotMenu({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#6c8289] transition hover:bg-[#eef8f4] hover:text-[#124741]"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 min-w-[160px] overflow-hidden rounded-2xl border bg-white shadow-xl" style={{ borderColor: '#e2eeea' }}>
            <Link
              href={`/forms/${formId}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#124741] hover:bg-[#eef8f4]"
              onClick={() => setOpen(false)}
            >
              <BarChart3 className="size-3.5 text-[#15a080]" /> View submissions
            </Link>
            <Link
              href={`/f/${formId}`}
              target="_blank"
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#124741] hover:bg-[#eef8f4]"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="size-3.5 text-[#6c8289]" /> Open form
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#124741] hover:bg-[#eef8f4]"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/f/${formId}`);
                setOpen(false);
              }}
            >
              <Copy className="size-3.5 text-[#6c8289]" /> Copy link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Colour accent per form (based on id hash) ───────────────────────────── */
const ACCENTS = [
  { bg: 'rgba(145,224,218,0.22)', color: '#124741' },
  { bg: 'rgba(139,92,246,0.12)',  color: '#5b21b6' },
  { bg: 'rgba(249,115,22,0.12)',  color: '#c2410c' },
  { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8' },
  { bg: 'rgba(236,72,153,0.12)',  color: '#9d174d' },
];
function accentFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return ACCENTS[h % ACCENTS.length];
}

/* ─── Grid card ───────────────────────────────────────────────────────────── */
function FormGridCard({ form }: { form: { id: string; title: string; status: DashboardFormStatus; responses: number; updatedAt: string } }) {
  const accent = accentFor(form.id);
  return (
    <article className="hub-card group relative flex flex-col gap-0 overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* colour stripe */}
      <div className="h-1 w-full" style={{ background: accent.color, opacity: 0.35 }} />

      <div className="flex flex-1 flex-col p-5">
        {/* icon + menu */}
        <div className="flex items-start justify-between">
          <div
            className="grid h-11 w-11 place-items-center rounded-2xl transition group-hover:scale-105"
            style={{ background: accent.bg, color: accent.color }}
          >
            <FileText className="size-5" />
          </div>
          <ThreeDotMenu formId={form.id} />
        </div>

        {/* title */}
        <h3 className="mt-3 line-clamp-2 text-sm font-extrabold leading-snug text-[#124741]">
          {form.title}
        </h3>

        {/* meta */}
        <p className="mt-1 text-xs text-[#6c8289]">
          Updated {form.updatedAt}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-xs font-bold text-[#6c8289]">
            {form.responses} response{form.responses !== 1 ? 's' : ''}
          </span>
          <StatusPill status={form.status} />
        </div>
      </div>

      {/* bottom action */}
      <Link
        href={`/forms/${form.id}`}
        className="flex items-center justify-center gap-1.5 border-t py-2.5 text-xs font-bold text-[#6c8289] transition hover:bg-[#eef8f4] hover:text-[#124741]"
        style={{ borderColor: '#e2eeea' }}
      >
        <BarChart3 className="size-3.5" /> View submissions
        <ChevronRight className="size-3.5" />
      </Link>
    </article>
  );
}

/* ─── List row ────────────────────────────────────────────────────────────── */
function FormListRow({ form }: { form: { id: string; title: string; status: DashboardFormStatus; responses: number; updatedAt: string } }) {
  const accent = accentFor(form.id);
  return (
    <li className="group relative">
      <Link
        href={`/forms/${form.id}`}
        className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#eef8f4]"
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition group-hover:scale-105"
          style={{ background: accent.bg, color: accent.color }}
        >
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-[#124741]">
            {form.title}
          </span>
          <p className="mt-0.5 text-xs text-[#6c8289]">
            {form.responses} response{form.responses !== 1 ? 's' : ''} · Updated {form.updatedAt}
          </p>
        </div>
        <StatusPill status={form.status} />
        <ChevronRight className="size-4 shrink-0 text-[#c5d8d4] transition group-hover:text-[#124741]" />
      </Link>
      <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
        <ThreeDotMenu formId={form.id} />
      </div>
    </li>
  );
}

/* ─── Skeleton loaders ────────────────────────────────────────────────────── */
function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-[20px]" />
      ))}
    </div>
  );
}
function ListSkeleton() {
  return (
    <div className="hub-card divide-y overflow-hidden" style={{ borderColor: '#e2eeea' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-none" />
      ))}
    </div>
  );
}

/* ─── Main content ────────────────────────────────────────────────────────── */
function AllFormsContent() {
  const account = useCurrentAccount();
  const walletNetwork = account?.chains?.[0]?.startsWith('sui:')
    ? account.chains[0].slice(4)
    : undefined;
  const isCorrectNetwork = !walletNetwork || walletNetwork === SUI_NETWORK;
  const { data: forms = [], isLoading } = useOwnedForms(account?.address, isCorrectNetwork);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [view, setView]               = useState<ViewMode>('grid');

  const enriched = useMemo(
    () =>
      forms.map((f) => ({
        id: f.id,
        title: f.title,
        status: (f.is_active ? 'Active' : 'Closed') as DashboardFormStatus,
        responses: f.submission_count,
        updatedAt: new Date(f.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
      })),
    [forms],
  );

  const filtered = useMemo(
    () =>
      enriched.filter(
        (f) =>
          (statusFilter === 'All' || f.status === statusFilter) &&
          f.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [enriched, search, statusFilter],
  );

  const counts = useMemo(
    () => ({
      all:    enriched.length,
      active: enriched.filter((f) => f.status === 'Active').length,
      closed: enriched.filter((f) => f.status === 'Closed').length,
    }),
    [enriched],
  );

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'All',    label: 'All',    count: counts.all    },
    { key: 'Active', label: 'Active', count: counts.active },
    { key: 'Closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <WalletGuard>
      <div className="space-y-6" style={{ fontFamily: 'var(--font-ui)' }}>

        {/* ── Hero banner ── */}
        <section
          className="relative overflow-hidden rounded-[20px] p-7 md:p-10"
          style={{
            background: 'linear-gradient(135deg, #eef8f4 0%, #d4f5ef 55%, #c2ede7 100%)',
            border: '1px solid rgba(145,224,218,0.45)',
          }}
        >
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-8 left-1/4 h-36 w-36 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }} />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/60 text-[#124741] backdrop-blur-sm transition hover:bg-white hover:shadow-sm"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <h1
                  className="text-3xl text-[#124741] md:text-4xl"
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.04em' }}
                >
                  All Forms
                </h1>
                <p className="mt-0.5 text-sm font-semibold text-[#314e50]">
                  {counts.all} form{counts.all !== 1 ? 's' : ''} · {counts.active} active
                </p>
              </div>
            </div>

            <Link
              href="/builder"
              className="inline-flex w-fit items-center gap-2 rounded-[14px] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
              style={{ background: '#124741' }}
            >
              <Plus className="size-4" />
              New form
            </Link>
          </div>

          {/* stat chips */}
          <div className="relative mt-5 flex flex-wrap gap-2">
            {[
              { label: 'Total',  value: counts.all,    color: '#124741' },
              { label: 'Active', value: counts.active, color: '#15a080' },
              { label: 'Closed', value: counts.closed, color: '#b91c1c' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 backdrop-blur-sm"
                style={{ border: '1px solid rgba(145,224,218,0.4)' }}
              >
                <span className="text-lg font-extrabold" style={{ color }}>{value}</span>
                <span className="text-xs font-bold text-[#6c8289]">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Toolbar ── */}
        <div className="hub-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#6c8289]" />
              <input
                type="text"
                placeholder="Search forms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm text-[#124741] placeholder:text-[#6c8289] outline-none transition focus:border-[#91e0da]"
                style={{ borderColor: '#e2eeea', background: '#f9fdfb' }}
              />
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: '#eef8f4' }}>
              {statusTabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                  style={
                    statusFilter === key
                      ? { background: '#124741', color: '#fff' }
                      : { color: '#6c8289' }
                  }
                >
                  {label}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none"
                    style={
                      statusFilter === key
                        ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                        : { background: 'rgba(108,130,137,0.15)', color: '#6c8289' }
                    }
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: '#eef8f4' }}>
              {([['grid', LayoutGrid], ['list', List]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className="grid h-8 w-8 place-items-center rounded-lg transition"
                  style={view === mode ? { background: '#124741', color: '#fff' } : { color: '#6c8289' }}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          view === 'grid' ? <GridSkeleton /> : <ListSkeleton />
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="hub-card flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-5 grid h-16 w-16 place-items-center rounded-3xl"
              style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}
            >
              <FileText className="size-8" />
            </div>
            <p className="text-base font-extrabold text-[#124741]">
              {search || statusFilter !== 'All' ? 'No forms match your filters' : 'No forms yet'}
            </p>
            <p className="mt-1.5 max-w-xs text-sm text-[#6c8289]">
              {search || statusFilter !== 'All'
                ? "Try adjusting your search or filter to find what you're looking for."
                : 'Create your first form and start collecting responses today.'}
            </p>
            {!search && statusFilter === 'All' && (
              <Link
                href="/builder"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#124741] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d3530]"
              >
                <Plus className="size-4" />
                Create your first form
              </Link>
            )}
          </div>
        ) : view === 'grid' ? (
          /* Grid view */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((form) => (
              <FormGridCard key={form.id} form={form} />
            ))}
            {/* "New form" card */}
            <Link
              href="/builder"
              className="hub-card group flex flex-col items-center justify-center gap-3 py-12 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderStyle: 'dashed', borderColor: '#c5d8d4' }}
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl transition group-hover:scale-110"
                style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}>
                <Plus className="size-5" />
              </div>
              <span className="text-sm font-bold text-[#6c8289] transition group-hover:text-[#124741]">
                New form
              </span>
            </Link>
          </div>
        ) : (
          /* List view */
          <div className="hub-card overflow-hidden">
            {/* Table header */}
            <div
              className="grid grid-cols-[1fr_auto_auto] items-center border-b px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#6c8289]"
              style={{ borderColor: '#e2eeea', background: '#f9fdfb' }}
            >
              <span>Form</span>
              <span className="pr-24">Status</span>
            </div>
            <ul className="divide-y" style={{ borderColor: '#e2eeea' }}>
              {filtered.map((form) => (
                <FormListRow key={form.id} form={form} />
              ))}
            </ul>
          </div>
        )}

        {/* result count */}
        {!isLoading && filtered.length > 0 && (
          <p className="pb-2 text-center text-xs text-[#6c8289]">
            Showing {filtered.length} of {counts.all} form{counts.all !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </WalletGuard>
  );
}

export default function AllFormsPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f4fcf7' }}>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">
        <AllFormsContent />
      </main>
      <AppFooter />
    </div>
  );
}
