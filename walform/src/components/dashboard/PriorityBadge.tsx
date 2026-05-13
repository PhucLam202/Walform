import type { SubmissionPriority } from '@/types/submission';

interface PriorityBadgeProps {
  priority: SubmissionPriority;
}

const PRIORITY_CONFIG: Record<SubmissionPriority, { label: string; className: string }> = {
  critical: { label: '🔴 Critical', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  high:     { label: '🟠 High',     className: 'border-orange-200 bg-orange-50 text-orange-700' },
  medium:   { label: '🟡 Medium',   className: 'border-amber-200 bg-amber-50 text-amber-700' },
  low:      { label: '🟢 Low',      className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
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
