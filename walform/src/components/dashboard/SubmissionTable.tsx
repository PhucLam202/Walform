'use client';

import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { SubmissionRow } from './SubmissionRow';
import { SubmissionFilters } from './SubmissionFilters';
import { useAnnotations } from '@/hooks/useAnnotations';
import type { SubmissionStatus } from '@/types/submission';

interface SubmissionTableProps {
  blobIds: string[];
  formId: string;
  onViewDetail: (blobId: string) => void;
}

export function SubmissionTable({ blobIds, formId, onViewDetail }: SubmissionTableProps) {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const { getAnnotation } = useAnnotations(formId, null, null);

  let filteredIds = sortOrder === 'newest' ? [...blobIds].reverse() : [...blobIds];
  if (statusFilter !== 'all') {
    filteredIds = filteredIds.filter((id) => getAnnotation(id).status === statusFilter);
  }

  if (blobIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/60 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
          <Inbox className="size-7" />
        </div>
        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">
          No submissions yet
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
          Share your form link to start collecting encrypted responses.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SubmissionFilters
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={filteredIds.length}
      />
      {filteredIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <p className="text-sm text-slate-500">No submissions match the current filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredIds.map((blobId, i) => (
            <SubmissionRow
              key={blobId}
              index={i}
              blobId={blobId}
              formId={formId}
              onViewDetail={onViewDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
