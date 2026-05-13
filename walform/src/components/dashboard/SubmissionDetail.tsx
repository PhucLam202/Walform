'use client';

import { useState } from 'react';
import { Lock, Unlock, Loader2, Clock, FileText, Shield, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSubmission } from '@/hooks/useSubmissions';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useDecrypt } from '@/hooks/useDecrypt';
import { useFormDetail, useFormFieldLabels } from '@/hooks/useForms';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { FileBlobPreview } from './FileBlobPreview';
import type { SubmissionPriority } from '@/types/submission';

interface SubmissionDetailProps {
  blobId: string | null;
  formId: string;
  adminCapId: string | null;
  onClose: () => void;
}

export function SubmissionDetail({ blobId, formId, adminCapId, onClose }: SubmissionDetailProps) {
  const { data: submission, isLoading } = useSubmission(blobId ?? undefined);
  const { data: form } = useFormDetail(formId);
  const fieldLabels = useFormFieldLabels(form?.config_blob_id);
  const { decrypt, decrypting, getSessionKey } = useDecrypt();
  const { getAnnotation, setNote, setPriority, isSaving } = useAnnotations(formId, adminCapId, getSessionKey());

  const annotation = blobId ? getAnnotation(blobId) : null;
  const [decryptedFields, setDecryptedFields] = useState<Record<string, unknown> | null>(null);

  async function handleDecrypt() {
    if (!submission?.encryptedFields || !blobId || !adminCapId) return;
    try {
      const plaintext = await decrypt({
        formId,
        adminCapId,
        encryptedData: submission.encryptedFields,
      });
      setDecryptedFields(JSON.parse(plaintext));
      toast.success('Decrypted successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Decrypt failed: ' + msg);
    }
  }

  return (
    <Dialog open={!!blobId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="
          !max-w-none !w-[min(780px,calc(100vw-2rem))]
          max-h-[88vh] overflow-y-auto
          rounded-[2rem] border border-slate-200 bg-white p-0
          shadow-[0_32px_80px_-12px_rgba(0,0,0,0.18)]
          sm:!max-w-none
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-8 py-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <FileText className="size-5" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                Submission Detail
              </h2>
            </div>
            {submission && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400 pl-[52px]">
                <Clock className="size-3.5" />
                Submitted: {new Date(submission.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner label="Loading submission…" />
            </div>
          ) : !submission ? (
            <p className="text-sm text-slate-500">Could not load submission.</p>
          ) : (
            <div className="space-y-7">
              {/* Plain fields */}
              {Object.keys(submission.plainFields).length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="size-3.5 text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Fields
                    </h3>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                    {Object.entries(submission.plainFields).map(([key, val]) => (
                      <div key={key} className="flex gap-6 px-5 py-4">
                        <span className="w-44 shrink-0 text-sm font-bold capitalize text-slate-500">
                          {fieldLabels[key] ?? key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm break-words text-slate-900 flex-1">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Encrypted fields */}
              {submission.encryptedFields && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Shield className="size-3.5 text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Encrypted Fields
                    </h3>
                  </div>

                  {decryptedFields ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 divide-y divide-emerald-100">
                      {Object.entries(decryptedFields).map(([key, val]) => (
                        <div key={key} className="flex gap-6 px-5 py-4">
                          <span className="w-44 shrink-0 text-sm font-bold capitalize text-emerald-700">
                            {fieldLabels[key] ?? key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm break-words text-slate-900 flex-1">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
                      <div className="flex items-center gap-2.5">
                        <Lock className="size-4 text-amber-600" />
                        <p className="text-sm font-bold text-amber-700">
                          Fields are end-to-end encrypted with Seal
                        </p>
                      </div>
                      <button
                        onClick={handleDecrypt}
                        disabled={decrypting || !adminCapId}
                        className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-amber-700 disabled:opacity-50"
                      >
                        {decrypting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Unlock className="size-4" />
                        )}
                        Decrypt
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* File blobs */}
              {submission.fileBlobs && Object.keys(submission.fileBlobs).length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Paperclip className="size-3.5 text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Attached Files
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(submission.fileBlobs).map(([key, fileInfo]) => {
                      const info = typeof fileInfo === 'string'
                        ? { blobId: fileInfo, mimeType: 'application/octet-stream', fileName: key }
                        : fileInfo;
                      return (
                        <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm capitalize text-slate-600 mb-2">{key.replace(/_/g, ' ')}</p>
                          <FileBlobPreview
                            blobId={info.blobId}
                            mimeType={info.mimeType}
                            fileName={info.fileName}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Priority */}
              {blobId && annotation && (
                <section>
                  <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Priority</h3>
                  <div className="flex flex-wrap gap-2">
                    {(['critical', 'high', 'medium', 'low'] as SubmissionPriority[]).map((p) => {
                      const PRIORITY_CONFIG = {
                        critical: { label: '🔴 Critical', active: 'bg-rose-600 text-white border-rose-600', inactive: 'border-rose-200 text-rose-700 hover:bg-rose-50' },
                        high:     { label: '🟠 High',     active: 'bg-orange-500 text-white border-orange-500', inactive: 'border-orange-200 text-orange-700 hover:bg-orange-50' },
                        medium:   { label: '🟡 Medium',   active: 'bg-amber-400 text-white border-amber-400',  inactive: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
                        low:      { label: '🟢 Low',      active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
                      };
                      const cfg = PRIORITY_CONFIG[p];
                      const isActive = annotation.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setPriority(blobId, p)}
                          className={['rounded-2xl border px-4 py-2 text-sm font-extrabold transition', isActive ? cfg.active : cfg.inactive].join(' ')}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Private note */}
              {blobId && (
                <section>
                  <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                    Private Note
                    {isSaving && <span className="ml-1.5 normal-case font-normal text-slate-400">Saving…</span>}
                  </h3>
                  <textarea
                    key={blobId}
                    rows={4}
                    defaultValue={annotation?.note ?? ''}
                    onBlur={(e) => setNote(blobId, e.target.value)}
                    placeholder="Add a note visible only to you…"
                    className="wf-input resize-none text-sm"
                  />
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
