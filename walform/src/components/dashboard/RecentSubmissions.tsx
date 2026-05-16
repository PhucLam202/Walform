'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EXPLORER_BASE_URL } from '@/lib/constants';
import type { DashboardSubmission } from '@/types/dashboard';

const PAGE_SIZE = 10;

interface RecentSubmissionsProps {
  submissions: DashboardSubmission[];
  firstFormId?: string;
}

function StatusBadge({ status }: { status: DashboardSubmission['status'] }) {
  const map: Record<DashboardSubmission['status'], { bg: string; color: string }> = {
    'On-chain': { bg: 'rgba(145,224,218,0.2)', color: '#124741' },
    Pending: { bg: 'rgba(245,158,11,0.12)', color: '#92400e' },
    Failed: { bg: 'rgba(239,68,68,0.1)', color: '#b91c1c' },
  };
  const s = map[status];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function truncate(str: string | undefined, len = 8) {
  if (!str) return '—';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

export function RecentSubmissions({ submissions, firstFormId }: RecentSubmissionsProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(submissions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = submissions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '1rem' }}>
          Recent submissions
        </h3>
        <Link
          href={firstFormId ? `/forms/${firstFormId}` : '/dashboard'}
          className="text-xs font-bold text-[#6c8289] transition hover:text-[#124741]"
        >
          View all
        </Link>
      </div>

      <div className="hub-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs font-bold uppercase tracking-wider text-[#6c8289]"
              style={{ borderColor: 'rgba(108,130,137,0.15)' }}
            >
              {['Respondent', 'Form', 'Submitted', 'Status', 'Tx Hash'].map((h) => (
                <th key={h} className="px-4 py-3 first:pl-6 last:pr-6">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(108,130,137,0.1)' }}>
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-[#6c8289]"
                >
                  No submissions yet.
                </td>
              </tr>
            ) : (
              pageItems.map((s) => (
                <tr
                  key={s.id}
                  className="transition hover:bg-[rgba(145,224,218,0.05)]"
                >
                  <td className="px-4 py-3 pl-6">
                    <span className="font-bold text-[#124741]">
                      {s.respondentName
                        ? s.respondentName
                        : s.respondentWallet
                          ? truncate(s.respondentWallet, 10)
                          : 'Anonymous'}
                    </span>
                    {s.respondentEmail && (
                      <p className="text-xs text-[#6c8289]">{s.respondentEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#314e50]">{s.formTitle}</td>
                  <td className="px-4 py-3 text-[#6c8289]">{s.submittedAt}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 pr-6 font-mono text-xs text-[#6c8289]">
                    {s.txHash ? (
                      <a
                        href={`${EXPLORER_BASE_URL}/txblock/${s.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[#124741]"
                      >
                        {truncate(s.txHash, 12)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {submissions.length > PAGE_SIZE && (
          <div
            className="flex items-center justify-between border-t px-6 py-3"
            style={{ borderColor: 'rgba(108,130,137,0.15)' }}
          >
            <p className="text-xs text-[#6c8289]">
              {safePage * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE + PAGE_SIZE, submissions.length)} of {submissions.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#6c8289] transition hover:bg-[rgba(145,224,218,0.15)] hover:text-[#124741] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="size-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold transition"
                  style={
                    i === safePage
                      ? { background: 'rgba(145,224,218,0.25)', color: '#124741' }
                      : { color: '#6c8289' }
                  }
                >
                  {i + 1}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#6c8289] transition hover:bg-[rgba(145,224,218,0.15)] hover:text-[#124741] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
