'use client';

import { FileText, Users, MousePointerClick, Link as LinkIcon } from 'lucide-react';
import { StatCard } from './StatCard';

interface StatsGridProps {
  totalForms: number;
  totalSubmissions: number;
  uniqueRespondents: number;
  onChainTx: number;
  responsesLast7Days: number;
}

export function StatsGrid({ totalForms, totalSubmissions, uniqueRespondents, onChainTx, responsesLast7Days }: StatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<FileText className="size-5" />}
        label="Total forms"
        value={totalForms}
      />
      <StatCard
        icon={<Users className="size-5" />}
        label="Total submissions"
        value={totalSubmissions}
      />
      <StatCard
        icon={<MousePointerClick className="size-5" />}
        label="Responses in last 7 days"
        value={responsesLast7Days}
        trend={`${responsesLast7Days} response${responsesLast7Days !== 1 ? 's' : ''} this week`}
      />
      <StatCard
        icon={<LinkIcon className="size-5" />}
        label="On-chain transactions"
        value={onChainTx}
      />
    </div>
  );
}
