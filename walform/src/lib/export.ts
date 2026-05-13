import type { SubmissionBlob, SubmissionAnnotation } from '@/types/submission';
import type { FormConfig } from '@/types/form';

export function exportToCSV(params: {
  submissions: Array<{
    blobId: string;
    blob: SubmissionBlob;
    annotation?: SubmissionAnnotation;
    decryptedFields?: Record<string, unknown>;
  }>;
  formConfig: FormConfig;
  fileName?: string;
}): void {
  const { submissions, formConfig, fileName } = params;

  const fieldHeaders = formConfig.fields.map((f) => f.label);
  const headers = ['#', 'Submitted At', 'Blob ID', ...fieldHeaders, 'Status', 'Priority', 'Note'];

  const rows = submissions.map((s, i) => {
    const allFields: Record<string, unknown> = {
      ...s.blob.plainFields,
      ...(s.decryptedFields ?? {}),
    };
    const fieldValues = formConfig.fields.map((f) => {
      const v = allFields[f.id] ?? allFields[f.label] ?? '';
      return `"${String(v).replace(/"/g, '""')}"`;
    });
    return [
      i + 1,
      new Date(s.blob.submittedAt).toISOString(),
      s.blobId,
      ...fieldValues,
      s.annotation?.status ?? 'new',
      s.annotation?.priority ?? 'medium',
      `"${(s.annotation?.note ?? '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? `${formConfig.title}-submissions.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
