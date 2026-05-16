'use client';

import type { SubmissionStatus } from '@/types/submission';

interface SubmissionFiltersProps {
  statusFilter: SubmissionStatus | 'all';
  onStatusChange: (s: SubmissionStatus | 'all') => void;
  sortOrder: 'newest' | 'oldest';
  onSortChange: (s: 'newest' | 'oldest') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalCount: number;
}

const STATUS_OPTIONS: Array<{ value: SubmissionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'spam', label: 'Spam' },
];

export function SubmissionFilters({
  statusFilter,
  onStatusChange,
  sortOrder,
  onSortChange,
  searchQuery,
  onSearchChange,
  totalCount,
}: SubmissionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onStatusChange(value as SubmissionStatus | 'all')}
            className={
              statusFilter === value
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white'
                : 'rounded-full border px-3 py-1 text-xs font-bold text-slate-500 hover:border-slate-400'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select
        value={sortOrder}
        onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest')}
        className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-600"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>

      {/* Search */}
      <input
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search submissions…"
        className="rounded-xl border px-3 py-1.5 text-xs flex-1 min-w-[180px]"
      />

      <span className="ml-auto text-xs text-slate-400">{totalCount} result(s)</span>
    </div>
  );
}
