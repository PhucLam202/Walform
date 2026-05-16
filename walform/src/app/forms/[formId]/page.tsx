'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useFormDetail } from '@/hooks/useForms';
import { useSubmissionIndex } from '@/hooks/useSubmissions';
import { AppFooter } from '@/components/shared/AppFooter';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CopyButton } from '@/components/shared/CopyButton';
import { SubmissionTable } from '@/components/dashboard/SubmissionTable';
import { SubmissionDetail } from '@/components/dashboard/SubmissionDetail';
import { SyncPendingButton } from '@/components/dashboard/SyncPendingButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildToggleActiveTx } from '@/lib/contracts';
import { getAdminCap } from '@/lib/sui-client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Calendar,
  BarChart3,
  Settings,
  FileText,
  Power,
  Loader2,
  Download,
} from 'lucide-react';
import type { FormOnChain, FormConfig } from '@/types/form';
import type { SubmissionBlob } from '@/types/submission';
import { exportToCSV } from '@/lib/export';
import { downloadJSON } from '@/lib/walrus';
import { PACKAGE_ID, SUI_NETWORK, explorerObjectUrl, walrusBlobUrl } from '@/lib/constants';
import { useAnnotations } from '@/hooks/useAnnotations';

/* ── helpers ── */

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
      style={
        active
          ? { background: 'color-mix(in srgb, var(--hub-accent) 20%, transparent)', color: 'var(--hub-primary)' }
          : { background: 'rgba(239,68,68,0.1)', color: '#b91c1c' }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: active ? '#91e0da' : '#ef4444' }}
      />
      {active ? 'Active' : 'Closed'}
    </span>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <article className="hub-card flex flex-col gap-3 p-6" style={{ fontFamily: 'var(--font-ui)' }}>
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: 'color-mix(in srgb, var(--hub-accent) 18%, transparent)', color: 'var(--hub-primary)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--hub-muted)]">{label}</p>
        <p className="mt-1 text-3xl font-black text-[var(--hub-primary)]" style={{ letterSpacing: '-0.04em' }}>
          {value}
        </p>
      </div>
    </article>
  );
}

function BlobRow({
  label, value, walrusUrl, isObjectId, empty,
}: {
  label: string; value: string; walrusUrl?: string; isObjectId?: boolean; empty?: boolean;
}) {
  if (empty || !value) {
    return (
      <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
        style={{ borderColor: 'var(--hub-border)' }}>
        <span className="text-sm text-[var(--hub-muted)]">{label}</span>
        <span className="text-xs italic text-[var(--hub-muted)]">none</span>
      </div>
    );
  }
  const explorerUrl = isObjectId ? explorerObjectUrl(value) : undefined;
  return (
    <div className="border-b py-3 last:border-0" style={{ borderColor: 'var(--hub-border)' }}>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[var(--hub-muted)]">{label}</p>
      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
        style={{ background: 'var(--hub-surface-soft)' }}>
        <code className="flex-1 truncate font-mono text-xs text-[var(--hub-primary)]">{value}</code>
        <CopyButton value={value} label="" className="h-6 w-6 shrink-0 p-0 text-[var(--hub-muted)] hover:text-[var(--hub-primary)]" />
        {walrusUrl && (
          <a href={walrusUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs font-bold text-[var(--hub-primary)] hover:underline">
            Walrus ↗
          </a>
        )}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs font-bold text-[var(--hub-primary)] hover:underline">
            Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
}

/* ── main content ── */

function FormDetailContent({ formId }: { formId: string }) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [detailBlobId, setDetailBlobId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: form, isLoading: loadingForm, refetch: refetchForm } = useFormDetail(formId);
  const { data: index } = useSubmissionIndex(form?.submissions_index_blob_id);

  const { data: adminCapId } = useQuery({
    queryKey: ['admin-cap', SUI_NETWORK, PACKAGE_ID, account?.address, formId],
    queryFn: () => getAdminCap(account!.address, formId),
    enabled: !!account?.address,
  });

  const { getAnnotation } = useAnnotations(formId, adminCapId ?? null, null);

  async function handleToggleActive() {
    if (!adminCapId || !form) return;
    setToggling(true);
    try {
      const tx = buildToggleActiveTx({ formObjectId: form.id, adminCapId });
      const res = await signAndExecuteTransaction({ transaction: tx });
      await suiClient.waitForTransaction({ digest: res.digest });
      await refetchForm();
      toast.success(form.is_active ? 'Form closed' : 'Form activated');
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      toast.error('Toggle failed: ' + ((e?.message as string) || JSON.stringify(err)));
    } finally {
      setToggling(false);
    }
  }

  function handleSynced(newIndexBlobId: string, syncedCount: number) {
    queryClient.setQueryData<FormOnChain>(['form', SUI_NETWORK, PACKAGE_ID, formId], (old) =>
      old ? { ...old, submissions_index_blob_id: newIndexBlobId, submission_count: old.submission_count + syncedCount } : old,
    );
    queryClient.setQueryData<FormOnChain[]>(['owned-forms', SUI_NETWORK, PACKAGE_ID, account?.address], (old) =>
      old?.map((f) => f.id === formId ? { ...f, submission_count: f.submission_count + syncedCount } : f),
    );
    queryClient.invalidateQueries({ queryKey: ['submission-index', SUI_NETWORK] });
    setTimeout(() => {
      refetchForm();
      queryClient.invalidateQueries({ queryKey: ['owned-forms', SUI_NETWORK, PACKAGE_ID] });
    }, 5000);
  }

  async function handleExport() {
    if (!form) return;
    setExporting(true);
    try {
      const formConfig = await downloadJSON<FormConfig>(form.config_blob_id);
      const blobIdsToExport = index?.blobIds ?? [];
      const submissions = await Promise.all(
        blobIdsToExport.map(async (id) => {
          const cached = queryClient.getQueryData<SubmissionBlob>(['submission', SUI_NETWORK, id]);
          const blob = cached ?? await downloadJSON<SubmissionBlob>(id);
          return { blobId: id, blob, annotation: getAnnotation(id) };
        }),
      );
      exportToCSV({ submissions, formConfig, fileName: `${form.title}.csv` });
      toast.success(`Exported ${submissions.length} submissions`);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      toast.error('Export failed: ' + ((e?.message as string) || String(err)));
    } finally {
      setExporting(false);
    }
  }

  if (loadingForm) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72 rounded-[16px]" />
        <Skeleton className="h-6 w-48 rounded-[12px]" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-[16px]" />)}
        </div>
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#b91c1c' }}>
          <FileText className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[var(--hub-primary)]">Form not found</h2>
        <p className="mt-2 text-sm text-[var(--hub-muted)]">This form may have been deleted or does not exist.</p>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form.id}` : `/f/${form.id}`;
  const blobIds = index?.blobIds ?? [];

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-ui)' }}>

      {/* ── Hero card ── */}
      <section
        className="rounded-[20px] p-7"
        style={{
          background: 'linear-gradient(135deg, var(--hub-hero-gradient-start) 0%, var(--hub-hero-gradient-mid) 100%)',
          border: '1px solid rgba(145,224,218,0.45)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--hub-accent) 25%, transparent)', color: 'var(--hub-primary)' }}
              >
                <FileText className="size-5" />
              </div>
              <div>
                <h1
                  className="text-2xl text-[var(--hub-primary)]"
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700 }}
                >
                  {form.title}
                </h1>
                {form.description && (
                  <p className="mt-0.5 text-sm text-[var(--hub-muted)]">{form.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-14">
              <StatusPill active={form.is_active} />
              <span className="text-xs capitalize text-[var(--hub-muted)]">
                {form.form_type.replace(/_/g, ' ')} form
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              value={shareUrl}
              label="Copy Link"
              className="inline-flex items-center gap-2 rounded-[14px] border bg-[var(--hub-surface)]/80 px-4 py-2.5 text-sm font-bold text-[var(--hub-primary)] shadow-sm backdrop-blur-sm transition hover:bg-white"
              style={{ borderColor: 'rgba(145,224,218,0.5)' } as React.CSSProperties}
            />
            {adminCapId && (
              <SyncPendingButton form={form} adminCapId={adminCapId} onSynced={handleSynced} />
            )}
            {adminCapId && blobIds.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-[14px] border bg-[var(--hub-surface)]/80 px-4 py-2.5 text-sm font-bold text-[var(--hub-primary)] shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-50"
                style={{ borderColor: 'rgba(145,224,218,0.5)' }}
              >
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Export CSV
              </button>
            )}
            {adminCapId && (
              <button
                onClick={handleToggleActive}
                disabled={toggling}
                className="inline-flex items-center gap-2 rounded-[14px] border bg-[var(--hub-surface)]/80 px-4 py-2.5 text-sm font-bold text-[var(--hub-primary)] shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-50"
                style={{ borderColor: 'rgba(145,224,218,0.5)' }}
              >
                {toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                {form.is_active ? 'Close Form' : 'Reopen Form'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Users className="size-5" />} label="Total Submissions" value={blobIds.length} />
        <StatCard icon={<BarChart3 className="size-5" />} label="On-chain Count" value={form.submission_count} />
        <StatCard icon={<Calendar className="size-5" />} label="Created" value={new Date(form.created_at).toLocaleDateString()} />
      </section>

      {/* ── Tabs ── */}
      <Tabs defaultValue="submissions">
        <TabsList
          className="flex w-fit rounded-[14px] p-1 gap-0.5"
          style={{ background: 'var(--hub-surface-soft)', border: '1px solid var(--hub-border-accent)' }}
        >
          <TabsTrigger
            value="submissions"
            className="rounded-xl px-4 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[var(--hub-primary)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--hub-muted)] data-[state=inactive]:hover:text-[var(--hub-primary)]"
          >
            Submissions ({blobIds.length})
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[var(--hub-primary)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--hub-muted)] data-[state=inactive]:hover:text-[var(--hub-primary)]"
          >
            <Settings className="size-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-5">
          <SubmissionTable
            blobIds={blobIds}
            formId={form.id}
            onViewDetail={(blobId) => setDetailBlobId(blobId)}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <div className="hub-card p-7">
            <h3
              className="mb-5 text-lg text-[var(--hub-primary)]"
              style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700 }}
            >
              Technical Details
            </h3>
            <BlobRow label="Form ID" value={form.id} isObjectId />
            <BlobRow
              label="Config Blob"
              value={form.config_blob_id}
              walrusUrl={walrusBlobUrl(form.config_blob_id)}
            />
            <BlobRow
              label="Index Blob"
              value={form.submissions_index_blob_id ?? ''}
              walrusUrl={form.submissions_index_blob_id
                ? walrusBlobUrl(form.submissions_index_blob_id)
                : undefined}
              empty={!form.submissions_index_blob_id}
            />
            <BlobRow label="Admin Cap" value={adminCapId ?? ''} isObjectId empty={!adminCapId} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Submission detail modal */}
      <SubmissionDetail
        blobId={detailBlobId}
        formId={form.id}
        adminCapId={adminCapId ?? null}
        onClose={() => setDetailBlobId(null)}
      />
    </div>
  );
}

export default function FormDetailPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f4fcf7' }}>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--hub-muted)] transition hover:text-[var(--hub-primary)]"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <FormDetailContent formId={formId} />
      </main>
      <AppFooter className="!bg-[rgba(244,252,247,0.9)]" />
    </div>
  );
}
