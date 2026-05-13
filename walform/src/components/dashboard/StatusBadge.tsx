import type { SubmissionStatus } from '@/types/submission';

interface StatusBadgeProps {
  status: SubmissionStatus;
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  new: {
    label: 'New',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  resolved: {
    label: 'Resolved',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  spam: {
    label: 'Spam',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold',
        config.className,
      ].join(' ')}
    >
      {config.label}
    </span>
  );
}
