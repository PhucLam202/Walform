'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, ConnectButton } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useBuilderStore } from '@/store/builder';
import { FieldPalette } from '@/components/builder/FieldPalette';
import { FormCanvas } from '@/components/builder/FormCanvas';
import { FormPreview } from '@/components/builder/FormPreview';
import { FieldPropertiesPanel } from '@/components/builder/FieldPropertiesPanel';
import { TemplatePicker } from '@/components/builder/TemplatePicker';
import { BuilderDndContext } from '@/components/builder/BuilderDndContext';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadJSON } from '@/lib/walrus';
import { buildCreateFormTx, extractFormAndCap } from '@/lib/contracts';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';

function WalletRequired() {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-6"
      style={{ background: 'var(--hub-bg)', fontFamily: 'var(--font-ui)' }}
    >
      <BrandLogo href="/" />
      <div
        className="flex flex-col items-center gap-5 rounded-[24px] border px-10 py-10 shadow-sm"
        style={{ background: 'var(--hub-surface)', borderColor: 'var(--hub-border)', maxWidth: 420 }}
      >
        <div
          className="flex size-14 items-center justify-center rounded-full"
          style={{ background: 'var(--hub-surface-soft)' }}
        >
          <Wallet className="size-7" style={{ color: 'var(--hub-primary)' }} />
        </div>
        <div className="text-center">
          <h2
            className="text-2xl text-[var(--hub-primary)]"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700 }}
          >
            Connect your wallet
          </h2>
          <p className="mt-2 text-sm text-[var(--hub-muted)]">
            You need to connect a Sui wallet to access the form builder.
          </p>
        </div>
        <ConnectButton />
        <Link
          href="/"
          className="text-xs text-[var(--hub-muted)] underline-offset-2 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function BuilderPage() {
  const account = useCurrentAccount();
  if (!account) return <WalletRequired />;
  return <BuilderInner />;
}

function BuilderInner() {
  const router = useRouter();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [publishing, setPublishing] = useState(false);

  const config = useBuilderStore((s) => s.config);
  const setTitle = useBuilderStore((s) => s.setTitle);
  const setDescription = useBuilderStore((s) => s.setDescription);
  const setFormType = useBuilderStore((s) => s.setFormType);
  const reset = useBuilderStore((s) => s.reset);

  async function handlePublish() {
    if (!account?.address) { toast.error('Connect your wallet first'); return; }
    if (!config.title.trim()) { toast.error('Please add a form title'); return; }
    if (config.fields.length === 0) { toast.error('Add at least one field'); return; }

    setPublishing(true);
    try {
      const { blobId: configBlobId } = await uploadJSON(config);
      const tx = buildCreateFormTx({
        title: config.title,
        description: config.description,
        formType: config.form_type,
        configBlobId,
      });
      const txResult = await signAndExecuteTransaction({ transaction: tx });
      await suiClient.waitForTransaction({ digest: txResult.digest });
      const fullResult = await suiClient.getTransactionBlock({
        digest: txResult.digest,
        options: { showObjectChanges: true, showEffects: true },
      });
      const { formId } = extractFormAndCap(fullResult as SuiTransactionBlockResponse);
      toast.success('Form published!');
      reset();
      router.push(`/forms/${formId}`);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const msg = (e?.message as string) || (e?.cause as string) || JSON.stringify(err);
      toast.error('Publish failed: ' + msg);
      console.error('[create_form]', err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--hub-bg)', fontFamily: 'var(--font-ui)' }}
    >
      {/* ── Top bar ── */}
      <header
        className="hub-glass-header mx-3 mt-3 flex shrink-0 items-center gap-4 rounded-[18px] px-5"
        style={{ height: 58 }}
      >
        {/* Brand + back */}
        <div className="flex items-center gap-3">
          <BrandLogo href="/" className="mr-1" />
          <div className="h-5 w-px" style={{ background: 'var(--hub-border)' }} />
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--hub-muted)] transition hover:text-[var(--hub-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
        </div>

        <div className="h-5 w-px" style={{ background: 'var(--hub-border)' }} />

        {/* Title input */}
        <div className="min-w-0 flex-1">
          <input
            value={config.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title…"
            className="w-full border-0 bg-transparent text-base font-bold text-[var(--hub-primary)] placeholder-[var(--hub-muted)] outline-none"
          />
        </div>

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="inline-flex items-center gap-2 rounded-[14px] px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--hub-primary)' }}
        >
          {publishing && <Loader2 className="size-4 animate-spin" />}
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </header>

      {/* ── Main layout ── */}
      <BuilderDndContext>
        <div className="flex flex-1 overflow-hidden gap-3 p-3 pt-3">

          {/* Left sidebar */}
          <aside
            className="hub-card flex w-[290px] shrink-0 flex-col gap-4 overflow-y-auto p-4"
          >
            {/* Form meta */}
            <section className="rounded-[16px] border p-4 space-y-4"
              style={{ background: 'var(--hub-surface-soft)', borderColor: 'var(--hub-border-accent)' }}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--hub-muted)]">
                  Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description…"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border bg-[var(--hub-surface)] px-3 py-2 text-sm text-[var(--hub-primary)] placeholder-[var(--hub-muted)] outline-none transition focus:border-[var(--hub-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--hub-accent)_30%,transparent)]"
                  style={{ borderColor: 'var(--hub-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--hub-muted)]">
                  Form type
                </label>
                <input
                  value={config.form_type}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. survey, bug_report"
                  className="mt-2 w-full rounded-xl border bg-[var(--hub-surface)] px-3 py-2 text-sm text-[var(--hub-primary)] placeholder-[var(--hub-muted)] outline-none transition focus:border-[var(--hub-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--hub-accent)_30%,transparent)]"
                  style={{ borderColor: 'var(--hub-border)' }}
                />
              </div>
            </section>

            {/* Field palette */}
            <section className="rounded-[16px] border p-4"
              style={{ background: 'var(--hub-surface)', borderColor: 'var(--hub-border)' }}>
              <FieldPalette />
            </section>

            {/* Templates */}
            <section className="rounded-[16px] border p-4"
              style={{ background: 'var(--hub-surface)', borderColor: 'var(--hub-border)' }}>
              <TemplatePicker />
            </section>
          </aside>

          {/* Center canvas */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--hub-muted)]">
                    Form Fields ({config.fields.length})
                  </p>
                  <h2
                    className="mt-1.5 text-2xl text-[var(--hub-primary)]"
                    style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700 }}
                  >
                    Build your form
                  </h2>
                </div>
              </div>

              <div
                className="hub-card min-h-[680px] p-7"
              >
                <FormCanvas />
              </div>
            </div>
          </main>

          {/* Right sidebar: Properties & Preview */}
          <aside className="hub-card hidden lg:flex shrink-0 flex-col overflow-hidden" style={{ width: 'clamp(300px, 28vw, 520px)', resize: 'horizontal', overflow: 'hidden' }}>
            <Tabs
              value={useBuilderStore((s) => s.selectedFieldId) ? 'properties' : 'preview'}
              onValueChange={(v) => {
                if (v === 'preview') useBuilderStore.getState().setSelectedFieldId(null);
              }}
              className="flex flex-col h-full"
            >
              <div className="shrink-0 p-4 pb-0">
                <TabsList
                  className="grid w-full grid-cols-2 rounded-[14px] p-1"
                  style={{ background: 'var(--hub-surface-soft)', border: '1px solid var(--hub-border-accent)' }}
                >
                  <TabsTrigger
                    value="properties"
                    className="rounded-xl text-sm font-bold data-[state=active]:bg-[var(--hub-surface)] data-[state=active]:text-[var(--hub-primary)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--hub-muted)]"
                  >
                    Properties
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="rounded-xl text-sm font-bold data-[state=active]:bg-[var(--hub-surface)] data-[state=active]:text-[var(--hub-primary)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--hub-muted)]"
                  >
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="properties"
                className="flex-1 min-h-0 overflow-y-auto p-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
              >
                <div className="rounded-[16px] border p-5"
                  style={{ background: 'var(--hub-surface)', borderColor: 'var(--hub-border)' }}>
                  <h3
                    className="text-xl text-[var(--hub-primary)]"
                    style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700 }}
                  >
                    Form Settings
                  </h3>
                  <div className="mt-4 divide-y" style={{ borderColor: 'var(--hub-border)' }}>
                    {[
                      { label: 'Title', val: config.title || 'Untitled Form' },
                      { label: 'Total fields', val: config.fields.length },
                      { label: 'Type', val: config.form_type || 'Custom' },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex justify-between gap-4 py-3">
                        <span className="text-sm text-[var(--hub-muted)]">{label}</span>
                        <strong className="text-right text-sm text-[var(--hub-primary)]">{val}</strong>
                      </div>
                    ))}
                  </div>
                  <FieldPropertiesPanel />
                </div>
              </TabsContent>

              <TabsContent
                value="preview"
                className="flex-1 min-h-0 overflow-y-auto p-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
              >
                <div className="rounded-[16px] border p-5"
                  style={{ background: 'var(--hub-surface)', borderColor: 'var(--hub-border)' }}>
                  <FormPreview />
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </BuilderDndContext>
    </div>
  );
}
