'use client';

import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useFormDetail } from '@/hooks/useForms';
import { downloadJSON, uploadSubmissionBlob } from '@/lib/walrus';
import { encryptForForm, getSealClient } from '@/lib/seal';
import { PACKAGE_ID } from '@/lib/constants';
import { FieldRenderer } from '@/components/form/FieldRenderer';
import { AppFooter } from '@/components/shared/AppFooter';
import { AppHeader } from '@/components/shared/AppHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { FormConfig, FormField } from '@/types/form';

// ─── Encrypted badge ───────────────────────────────────────────────────────────

function EncryptedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">
      🔒 Encrypted
    </span>
  );
}

// ─── Security notice ──────────────────────────────────────────────────────────

function SecurityNotice() {
  return (
    <div className="mt-7 flex gap-3.5 rounded-[22px] border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] p-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-600">
        🔒
      </div>
      <div>
        <h2 className="m-0 text-sm font-extrabold tracking-tight text-[var(--wf-foreground)]">
          Encrypted before submission
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--wf-muted-foreground)]">
          Selected fields are protected before leaving your browser and prepared for secure storage.
        </p>
      </div>
    </div>
  );
}

// ─── Individual field ─────────────────────────────────────────────────────────

function StyledFieldWrapper({
  field,
  children,
  error,
}: {
  field: FormField;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <label className="text-sm font-extrabold text-[var(--wf-foreground)]" htmlFor={field.id}>
          {field.label}
          {field.validation.required && (
            <span className="ml-1 text-violet-600">*</span>
          )}
        </label>
        {field.isSensitive && <EncryptedBadge />}
      </div>
      {field.helpText && (
        <p className="-mt-1 text-sm leading-5 text-[var(--wf-muted-foreground)]">{field.helpText}</p>
      )}
      {children}
      {error && (
        <p className="text-sm font-bold text-rose-700">{error}</p>
      )}
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SubmitSuccess({ formTitle, onReset }: { formTitle: string; onReset: () => void }) {
  return (
    <section className="rounded-[34px] border border-[var(--wf-border)] bg-[var(--wf-surface)]/95 px-8 py-11 text-center shadow-2xl shadow-slate-900/10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-emerald-200 bg-emerald-50 text-3xl font-black text-emerald-700 shadow-lg shadow-emerald-500/10">
        ✓
      </div>
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[var(--wf-foreground)]">
        Response submitted
      </h2>
      <p className="mx-auto mt-3 max-w-md leading-7 text-[var(--wf-muted-foreground)]">
        Your response to <strong className="text-[var(--wf-foreground)]">{formTitle}</strong> has been securely
        encrypted and submitted. You can safely close this page.
      </p>
      <button
        className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-extrabold text-[var(--wf-foreground)] transition hover:bg-[var(--wf-surface-muted)]"
        onClick={onReset}
        type="button"
      >
        Submit another response
      </button>
      <p className="mt-5 text-sm text-[var(--wf-muted-foreground)]">
        Powered by <strong className="text-[var(--wf-foreground)]">WalForm</strong>
      </p>
    </section>
  );
}

// ─── Full-screen states ───────────────────────────────────────────────────────

function FullScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          'radial-gradient(circle at top left,rgba(124,58,237,0.12),transparent 34rem),radial-gradient(circle at bottom right,rgba(34,211,238,0.10),transparent 30rem),linear-gradient(180deg,#fbfcff 0%,#f7f8fb 50%,#f3f5f9 100%)',
      }}
    >
      <AppHeader
        rightSlot={
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-extrabold text-violet-700">
            <span aria-hidden="true">🔒</span>
            <span className="max-sm:hidden">Secure Form</span>
          </div>
        }
        containerClassName="max-w-[1120px]"
      />
      <div className="flex flex-1 items-center justify-center px-4 py-16">{children}</div>
      <AppFooter className="bg-transparent" text="WalForm public forms protect sensitive responses before submission." />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FormFillPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params);
  const { data: form, isLoading: loadingForm } = useFormDetail(formId);

  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [fileBlobs, setFileBlobs] = useState<Record<string, { blobId: string; mimeType: string; fileName: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!form?.config_blob_id || config || loadingConfig) return;
    setLoadingConfig(true);
    setConfigError(null);
    downloadJSON<FormConfig>(form.config_blob_id)
      .then((cfg) => setConfig(cfg))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setConfigError(msg);
      })
      .finally(() => setLoadingConfig(false));
  }, [form?.config_blob_id, config, loadingConfig]);

  function handleChange(fieldId: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
    }
  }

  function handleFileUploaded(fieldId: string, blobId: string, file: File) {
    setFileBlobs((prev) => ({ ...prev, [fieldId]: { blobId, mimeType: file.type, fileName: file.name } }));
  }

  function validate(): boolean {
    if (!config) return false;
    const nextErrors: Record<string, string> = {};
    for (const field of config.fields) {
      if (field.validation.required) {
        const val = formValues[field.id];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          nextErrors[field.id] = 'This field is required.';
        }
      }
      if (field.type === 'email') {
        const val = String(formValues[field.id] ?? '');
        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          nextErrors[field.id] = 'Please enter a valid email address.';
        }
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !form || !config) return;

    setSubmitting(true);
    try {
      const sensitiveKeys = new Set(config.sensitiveFieldIds);
      const plainFields: Record<string, unknown> = {};
      const sensitiveData: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(formValues)) {
        if (sensitiveKeys.has(k)) sensitiveData[k] = v;
        else plainFields[k] = v;
      }

      let encryptedFields: string | undefined;
      let sealRef: string | undefined;

      if (Object.keys(sensitiveData).length > 0 && PACKAGE_ID) {
        try {
          const result = await encryptForForm({
            sealClient: getSealClient(),
            formId: form.id,
            data: JSON.stringify(sensitiveData),
          });
          encryptedFields = result.encryptedData;
          sealRef = result.sealRef;
        } catch {
          Object.assign(plainFields, sensitiveData);
          toast.warning('Seal not configured — sensitive fields stored unencrypted');
        }
      } else if (Object.keys(sensitiveData).length > 0) {
        Object.assign(plainFields, sensitiveData);
      }

      const submissionBlobId = await uploadSubmissionBlob({
        formId: form.id,
        formVersion: form.version,
        submittedAt: Date.now(),
        plainFields,
        encryptedFields,
        sealRef,
        fileBlobs,
      });

      await fetch('/api/notify-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: form.id, submissionBlobId }),
      });

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Submit failed: ' + msg);
    } finally {
      setSubmitting(false);
    }
  }

  const hasSensitiveFields = config?.fields.some((f) => f.isSensitive) ?? false;

  // ── Loading form ──
  if (loadingForm) {
    return (
      <FullScreenShell>
        <LoadingSpinner size="lg" label="Loading form…" />
      </FullScreenShell>
    );
  }

  // ── Form not found ──
  if (!form) {
    return (
      <FullScreenShell>
        <div className="rounded-[34px] border border-[var(--wf-border)] bg-[var(--wf-surface)]/95 px-10 py-12 text-center shadow-2xl shadow-slate-900/10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-rose-200 bg-rose-50 text-3xl text-rose-600">
            <AlertCircle className="size-7" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--wf-foreground)]">
            Form not found
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[var(--wf-muted-foreground)]">
            This form may not exist or has been removed.
          </p>
        </div>
      </FullScreenShell>
    );
  }

  // ── Form closed ──
  if (!form.is_active) {
    return (
      <FullScreenShell>
        <div className="rounded-[34px] border border-[var(--wf-border)] bg-[var(--wf-surface)]/95 px-10 py-12 text-center shadow-2xl shadow-slate-900/10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] text-3xl text-[var(--wf-muted-foreground)]">
            🚫
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--wf-foreground)]">
            This form is closed
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[var(--wf-muted-foreground)]">
            The creator has stopped accepting responses.
          </p>
        </div>
      </FullScreenShell>
    );
  }

  // ── Page shell ──
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at top left,rgba(124,58,237,0.12),transparent 34rem),radial-gradient(circle at bottom right,rgba(34,211,238,0.10),transparent 30rem),linear-gradient(180deg,#fbfcff 0%,#f7f8fb 50%,#f3f5f9 100%)',
      }}
    >
      <AppHeader
        rightSlot={
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-extrabold text-violet-700">
            <span aria-hidden="true">🔒</span>
            <span className="max-sm:hidden">Secure Form</span>
          </div>
        }
        containerClassName="max-w-[1120px]"
      />

      <main
        className="mx-auto grid gap-6 py-14 max-lg:max-w-[720px] max-lg:grid-cols-1"
        style={{
          width: 'min(1120px, calc(100% - 32px))',
          gridTemplateColumns: 'minmax(0,1fr) 680px minmax(0,1fr)',
        }}
      >
        {/* Left sidebar */}
        <aside className="sticky top-24 self-start pt-8 max-lg:hidden">
          <div className="rounded-3xl border border-slate-200 bg-[var(--wf-surface)]/70 p-5 shadow-sm backdrop-blur-xl">
            <h3 className="font-extrabold tracking-tight text-[var(--wf-foreground)]">
              Respond with confidence
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--wf-muted-foreground)]">
              Your response is protected before submission and designed to be stored securely
              through WalForm.
            </p>
            <div className="mt-5 flex flex-col gap-3 text-sm font-bold text-[var(--wf-foreground)]">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-[11px] border border-slate-200 bg-slate-50 text-xs">
                  🔒
                </span>
                End-to-end encrypted
              </div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-[11px] border border-slate-200 bg-slate-50 text-xs">
                  ◎
                </span>
                Stored on Walrus
              </div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-[11px] border border-slate-200 bg-slate-50 text-xs">
                  ◇
                </span>
                Powered by Sui
              </div>
            </div>
          </div>
        </aside>

        {/* Center form column */}
        <section>
          {submitted ? (
            <SubmitSuccess
              formTitle={form.title}
              onReset={() => {
                setSubmitted(false);
                setFormValues({});
                setFileBlobs({});
              }}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="relative overflow-hidden rounded-[34px] border border-[var(--wf-border)] bg-[var(--wf-surface)]/95 p-8 shadow-2xl shadow-slate-900/10 before:absolute before:inset-x-0 before:top-0 before:h-[7px] before:bg-gradient-to-r before:from-slate-950 before:via-violet-600 before:to-cyan-400 max-sm:p-6"
            >
              {/* Form title area */}
              <div className="mt-2 flex items-start justify-between gap-5 max-sm:flex-col">
                <div>
                  <h1 className="m-0 text-[clamp(32px,5vw,46px)] font-extrabold leading-none tracking-[-0.06em] text-[var(--wf-foreground)]">
                    {form.title}
                  </h1>
                  {form.description && (
                    <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--wf-muted-foreground)]">
                      {form.description}
                    </p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Accepting responses
                </span>
              </div>

              {/* Security notice — only when there are sensitive fields */}
              {hasSensitiveFields && <SecurityNotice />}

              {/* Loading config */}
              {loadingConfig && (
                <div className="mt-8 flex justify-center">
                  <LoadingSpinner label="Loading fields…" />
                </div>
              )}

              {/* Config error */}
              {configError && (
                <div className="mt-8 rounded-[22px] border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-rose-700">
                    <AlertCircle className="size-4 shrink-0" />
                    <p className="text-sm font-extrabold">Could not load form fields</p>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-rose-600">{configError}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-extrabold text-rose-700 transition hover:bg-[var(--wf-danger-bg)]"
                    onClick={() => {
                      setConfigError(null);
                      setLoadingConfig(false);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Fields */}
              {config && (
                <div className="mt-8 flex flex-col gap-6">
                  {config.fields.map((field) => (
                    <StyledFieldWrapper
                      key={field.id}
                      field={field}
                      error={fieldErrors[field.id]}
                    >
                      <div
                        className="[&_input]:h-[50px] [&_input]:rounded-[17px] [&_input]:border-slate-200 [&_input]:px-4 [&_input]:transition [&_input]:focus:border-violet-300 [&_input]:focus:ring-4 [&_input]:focus:ring-violet-100 [&_input]:focus:outline-none
                        [&_textarea]:min-h-[126px] [&_textarea]:rounded-[17px] [&_textarea]:border-slate-200 [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:transition [&_textarea]:focus:border-violet-300 [&_textarea]:focus:ring-4 [&_textarea]:focus:ring-violet-100 [&_textarea]:focus:outline-none
                        [&_select]:h-[50px] [&_select]:rounded-[17px] [&_select]:border-slate-200 [&_select]:px-4"
                      >
                        <FieldRenderer
                          field={field}
                          value={formValues[field.id]}
                          onChange={(v) => handleChange(field.id, v)}
                          onFileUploaded={handleFileUploaded}
                          hideLabel
                        />
                      </div>
                    </StyledFieldWrapper>
                  ))}
                </div>
              )}

              {/* Submit */}
              {config && (
                <div className="mt-8 flex flex-col gap-3.5">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border-0 bg-violet-600 font-black text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="size-5 animate-spin" />}
                    {submitting ? 'Submitting…' : 'Submit Response'}
                  </button>
                  <p className="text-center text-sm leading-6 text-[var(--wf-muted-foreground)]">
                    Powered by <strong className="text-[var(--wf-foreground)]">WalForm</strong>
                    <br />
                    Decentralized forms with encrypted responses.
                  </p>
                </div>
              )}
            </form>
          )}
        </section>

        {/* Right spacer */}
        <aside className="max-lg:hidden" />
      </main>
      <AppFooter className="bg-transparent" text="WalForm public forms protect sensitive responses before submission." />
    </div>
  );
}
