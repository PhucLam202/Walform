'use client';

import { useSubmission } from '@/hooks/useSubmissions';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useFormDetail, useFormFieldLabels } from '@/hooks/useForms';
import { StatusBadge } from './StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Lock, Eye } from 'lucide-react';

interface SubmissionRowProps {
  index: number;
  blobId: string;
  formId: string;
  onViewDetail: (blobId: string) => void;
}

export function SubmissionRow({ index, blobId, formId, onViewDetail }: SubmissionRowProps) {
  const { data: submission, isLoading } = useSubmission(blobId);
  const { data: form } = useFormDetail(formId);
  const fieldLabels = useFormFieldLabels(form?.config_blob_id);
  const { getAnnotation } = useAnnotations(formId, null, null);
  const annotation = getAnnotation(blobId);

  if (isLoading) {
    return (
      <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-10 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-3 w-36 rounded-full" />
        <Skeleton className="mt-2 h-3 w-full rounded-full" />
        <Skeleton className="mt-5 h-9 w-full rounded-2xl" />
      </article>
    );
  }

  if (!submission) return null;

  const plainPreview =
    Object.entries(submission.plainFields)
      .slice(0, 2)
      .map(([k, v]) => {
        const label = fieldLabels[k];
        const valStr = String(v).slice(0, 40);
        return label ? `${label}: ${valStr}` : valStr;
      })
      .join(' · ') || '—';

  const hasEncrypted = !!submission.encryptedFields;

  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg">
      {/* Top row: index + status */}
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-600">
          #{index + 1}
        </span>
        <StatusBadge status={annotation.status} />
      </div>

      {/* Timestamp */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Clock className="size-3 shrink-0" />
        {new Date(submission.submittedAt).toLocaleString()}
      </div>

      {/* Preview */}
      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="truncate text-sm text-slate-700">{plainPreview}</p>
        {hasEncrypted && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <Lock className="size-3 shrink-0" />
            Contains encrypted fields
          </p>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => onViewDetail(blobId)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-2.5 text-sm font-extrabold text-white transition hover:bg-violet-700"
      >
        <Eye className="size-3.5" />
        View Detail
      </button>
    </article>
  );
}
