'use client';

import { useMemo } from 'react';
import { DashboardHero } from './DashboardHero';
import { StatsGrid } from './StatsGrid';
import { QuickActions } from './QuickActions';
import { ResponseChart } from './ResponseChart';
import { RecentForms } from './RecentForms';
import { RecentSubmissions } from './RecentSubmissions';
import { WalletActivity } from './WalletActivity';
import { PopularForms } from './PopularForms';
import { TipCard } from './TipCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllSubmissions } from '@/hooks/useSubmissions';
import { useWalletActivity } from '@/hooks/useWalletActivity';
import type { FormOnChain } from '@/types/form';
import type { DashboardForm, DashboardSubmission } from '@/types/dashboard';

interface DashboardHomeHubProps {
  forms: FormOnChain[];
  isLoading: boolean;
  address?: string;
}

export function DashboardHomeHub({ forms, isLoading, address }: DashboardHomeHubProps) {
  const { submissions: loadedSubmissions } = useAllSubmissions(forms);
  const { data: walletActivity = [] } = useWalletActivity(address);

  const dashboardForms: DashboardForm[] = useMemo(
    () =>
      forms.map((f) => ({
        id: f.id,
        title: f.title,
        type: f.form_type,
        status: f.is_active ? 'Active' : 'Closed',
        responses: f.submission_count,
        questions: undefined,
        updatedAt: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      })),
    [forms],
  );

  const totalSubmissions = forms.reduce((s, f) => s + f.submission_count, 0);

  const submissionTimestamps = useMemo(
    () => loadedSubmissions.map((s) => s.blob.submittedAt),
    [loadedSubmissions],
  );

  const responsesLast7Days = useMemo(
    () => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return submissionTimestamps.filter((ts) => ts >= cutoff).length;
    },
    [submissionTimestamps],
  );

  const submissions: DashboardSubmission[] = useMemo(() => {
    return [...loadedSubmissions]
      .sort((a, b) => b.blob.submittedAt - a.blob.submittedAt)
      .map((s) => {
        const plain = s.blob.plainFields;
        const respondentName =
          (plain['name'] ?? plain['full_name'] ?? plain['fullName']) as string | undefined;
        const respondentEmail =
          (plain['email'] ?? plain['email_address']) as string | undefined;
        return {
          id: s.blobId,
          formTitle: s.formTitle,
          submittedAt: new Date(s.blob.submittedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          }),
          status: 'On-chain' as const,
          respondentName: respondentName ? String(respondentName) : undefined,
          respondentEmail: respondentEmail ? String(respondentEmail) : undefined,
          txHash: undefined,
        };
      });
  }, [loadedSubmissions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-[20px]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[20px]" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[20px]" />
          ))}
        </div>
        
        {/* Skeleton for the new Row 1: Chart & Recent Forms */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-64 w-full rounded-[20px]" />
          <Skeleton className="h-64 w-full rounded-[20px]" />
        </div>

        {/* Skeleton for Row 2: Submissions & Sidebar */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 w-full rounded-[20px]" />
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-[20px]" />
            <Skeleton className="h-48 w-full rounded-[20px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Hero — full width ── */}
      <DashboardHero />

      {/* ── Stats row — full width ── */}
      <StatsGrid
        totalForms={forms.length}
        totalSubmissions={totalSubmissions}
        uniqueRespondents={totalSubmissions}
        onChainTx={forms.length}
        responsesLast7Days={responsesLast7Days}
      />

      {/* ── Quick actions — full width ── */}
      <QuickActions />

      {/* ── Main Layout Rows ── */}
      <div className="space-y-6">
        {/* Row 1: Chart & Recent Forms */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <ResponseChart timestamps={submissionTimestamps} />
          <RecentForms forms={dashboardForms.slice(0, 4)} />
        </div>

        {/* Row 2: Submissions Table & Sidebar Activity */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* Left column: Submissions & Popular Forms */}
          <div id="submissions" className="space-y-6 min-w-0">
            <RecentSubmissions submissions={submissions} firstFormId={forms[0]?.id} />
            <PopularForms forms={dashboardForms} />
          </div>

          {/* Right column: Extra sidebar items */}
          <div className="space-y-5">
            <WalletActivity items={walletActivity} address={address} />
            <TipCard />
          </div>
        </div>
      </div>
    </div>
  );
}
