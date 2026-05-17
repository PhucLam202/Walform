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
import type { DashboardForm, DashboardSubmission, ChartDataPoint } from '@/types/dashboard';

interface DashboardHomeHubProps {
  forms: FormOnChain[];
  isLoading: boolean;
  address?: string;
}

function buildChartData(timestamps: number[]): ChartDataPoint[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    const responses = timestamps.filter((ts) => ts >= dayStart.getTime() && ts <= dayEnd.getTime()).length;
    return { day: label, responses };
  });
}

export function DashboardHomeHub({ forms, isLoading, address }: DashboardHomeHubProps) {
  const { submissions: loadedSubmissions, isLoading: submissionsLoading } = useAllSubmissions(forms);
  const { data: walletActivity = [] } = useWalletActivity(address);

  const dashboardForms: DashboardForm[] = useMemo(() => {
    // Count actual submissions per formId from Walrus data
    const walrusCount: Record<string, number> = {};
    for (const f of forms) walrusCount[f.id] = 0;
    for (const s of loadedSubmissions) {
      walrusCount[s.formId] = (walrusCount[s.formId] ?? 0) + 1;
    }

    return [...forms]
      .sort((a, b) => {
        const aTime = a.last_index_updated && a.last_index_updated > a.created_at ? a.last_index_updated : a.created_at;
        const bTime = b.last_index_updated && b.last_index_updated > b.created_at ? b.last_index_updated : b.created_at;
        return bTime - aTime;
      })
      .map((f) => ({
        id: f.id,
        title: f.title,
        type: f.form_type,
        status: f.is_active ? 'Active' : 'Closed',
        responses: Math.max(f.submission_count, walrusCount[f.id] ?? 0),
        questions: undefined,
        updatedAt: new Date(
          f.last_index_updated && f.last_index_updated > f.created_at
            ? f.last_index_updated
            : f.created_at,
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
  }, [forms, loadedSubmissions]);

  const totalSubmissions = useMemo(
    () => dashboardForms.reduce((s, f) => s + f.responses, 0),
    [dashboardForms],
  );

  const chartData = useMemo(
    () => buildChartData(loadedSubmissions.map((s) => s.blob.submittedAt)),
    [loadedSubmissions],
  );

  const responsesLast7Days = useMemo(
    () => chartData.reduce((sum, d) => sum + d.responses, 0),
    [chartData],
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
        onChainTx={walletActivity.length}
        responsesLast7Days={responsesLast7Days}
      />

      {/* ── Quick actions — full width ── */}
      <QuickActions />

      {/* ── Main Layout Rows ── */}
      <div className="space-y-6">
        {/* Row 1: Chart & Recent Forms */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <ResponseChart
            timestamps={loadedSubmissions.map((s) => s.blob.submittedAt)}
            isLoading={submissionsLoading}
          />
          <RecentForms forms={dashboardForms.slice(0, 4)} />
        </div>

        {/* Row 2: Submissions Table & Sidebar Activity */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* Left column: Submissions & Popular Forms */}
          <div className="space-y-6 min-w-0">
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
