'use client';

import Link from 'next/link';
import { CopyButton } from '@/components/shared/CopyButton';
import { FileText, Users, Calendar, BarChart3, Link2 } from 'lucide-react';
import type { FormOnChain } from '@/types/form';

interface FormCardProps {
  form: FormOnChain;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold',
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700',
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-rose-500',
        ].join(' ')}
      />
      {active ? 'Active' : 'Closed'}
    </span>
  );
}

export function FormCard({ form }: FormCardProps) {
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/f/${form.id}`
      : `/f/${form.id}`;

  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#91e0da] hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600">
            <FileText className="size-5" />
          </div>
          <h3 className="mt-4 line-clamp-2 text-xl font-extrabold tracking-tight text-slate-950">
            {form.title}
          </h3>
          <p className="mt-1 text-sm capitalize text-slate-500">
            {form.form_type.replace(/_/g, ' ')} form
          </p>
        </div>
        <StatusBadge active={form.is_active} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 shrink-0" />
          {form.submission_count} responses
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 shrink-0" />
          {new Date(form.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href={`/forms/${form.id}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#124741] px-4 text-sm font-extrabold text-white transition hover:bg-[#0d302c]"
        >
          <BarChart3 className="size-3.5" />
          View submissions
        </Link>
        <CopyButton
          value={shareUrl}
          label="Share"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#6c8289] transition hover:border-[#91e0da] hover:bg-[#eef8f4] hover:text-[#124741] shrink-0"
        />
      </div>
    </article>
  );
}
