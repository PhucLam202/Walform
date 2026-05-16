'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, MoreHorizontal, ExternalLink, Copy } from 'lucide-react';
import type { DashboardForm } from '@/types/dashboard';

interface RecentFormsProps {
  forms: DashboardForm[];
}

function StatusPill({ status }: { status: DashboardForm['status'] }) {
  const styles: Record<DashboardForm['status'], { bg: string; color: string }> = {
    Active: { bg: 'rgba(145,224,218,0.25)', color: '#124741' },
    Draft: { bg: 'rgba(108,130,137,0.12)', color: '#6c8289' },
    Closed: { bg: 'rgba(239,68,68,0.1)', color: '#b91c1c' },
  };
  const s = styles[status];
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function ThreeDotMenu({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-lg text-[#6c8289] transition hover:bg-[#eef8f4] hover:text-[#124741]"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-8 z-20 min-w-[140px] rounded-[12px] border bg-white p-1 shadow-lg"
            style={{ borderColor: 'var(--hub-border)' }}
          >
            <Link
              href={`/forms/${formId}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#124741] hover:bg-[#eef8f4]"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="size-3.5" /> View submissions
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#124741] hover:bg-[#eef8f4]"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/f/${formId}`);
                setOpen(false);
              }}
            >
              <Copy className="size-3.5" /> Copy link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function RecentForms({ forms }: RecentFormsProps) {
  return (
    <div className="hub-card p-6" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
          Recent forms
        </h3>
        <Link
          href="/dashboard/forms"
          className="text-xs font-bold text-[#6c8289] transition hover:text-[#124741]"
        >
          View all
        </Link>
      </div>

      {forms.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#6c8289]">No forms yet. Create one!</p>
      ) : (
        <ul className="space-y-1">
          {forms.map((form) => (
            <li key={form.id} className="group relative">
              <Link
                href={`/forms/${form.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#eef8f4]"
              >
                {/* Icon */}
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}
                >
                  <FileText className="size-4" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#124741]">
                    {form.title}
                  </span>
                  <p className="text-xs text-[#6c8289]">
                    {form.questions != null ? `${form.questions} questions` : `${form.responses} responses`}
                    {form.updatedAt ? ` · Updated ${form.updatedAt}` : ''}
                  </p>
                </div>

                {/* Status */}
                <StatusPill status={form.status} />
              </Link>

              {/* Three-dot menu sits outside the link to avoid nested interactives */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <ThreeDotMenu formId={form.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
