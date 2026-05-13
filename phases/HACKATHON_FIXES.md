# Hackathon Readiness — 5 Critical Fixes + Feature Gaps

> Priority order based on judge impact and demo risk.
> Each issue includes: what's broken, why it matters, exact files to touch, and step-by-step implementation.

---

## Fix 1 — Annotations stored in `localStorage` instead of Walrus (CRITICAL)

### What's broken
`useAnnotations.ts` saves status tags and private notes to `localStorage` only.
If the admin opens the dashboard on another device, browser, or after clearing storage — all annotations are gone.
During a live demo, this will look broken immediately.

**File:** `src/hooks/useAnnotations.ts` — lines 6–21

```ts
// Current broken approach
function readAll(formId: string) {
  return JSON.parse(localStorage.getItem(`walform:annotations:${formId}`) ?? '{}');
}
```

### Why it matters for judges
The hackathon prompt explicitly says: *"private admin dashboard where teams can sort through submissions, leave notes"*.
Notes that vanish on refresh fail this requirement entirely.
Also: `grant_admin` already exists in the contract — if two admins share a form, they can never see each other's notes with the current approach.

### How to fix — step by step

**Step 1: Add `AnnotationsBlob` type to `src/types/submission.ts`**
```ts
export interface AnnotationsBlob {
  formId: string;
  version: number;
  annotations: Record<string, SubmissionAnnotation>; // key = blobId
  updatedAt: number;
}
```

**Step 2: Create `src/lib/annotations.ts`**
This module handles Walrus read/write for annotations, encrypted with Seal so only admin can read.

```ts
import { uploadJSON, downloadJSON } from './walrus';
import { encryptForForm, decryptSubmission } from './seal';
import type { AnnotationsBlob } from '@/types/submission';
import type { SessionKey } from '@mysten/seal';

export async function fetchAnnotationsBlob(blobId: string): Promise<AnnotationsBlob> {
  return downloadJSON<AnnotationsBlob>(blobId);
}

export async function saveAnnotationsBlob(
  data: AnnotationsBlob,
  formId: string,
): Promise<string> {
  // Encrypt with Seal before uploading — only admin can read
  const { encryptedData } = await encryptForForm({ formId, data: JSON.stringify(data) });
  const { blobId } = await uploadJSON({ encrypted: encryptedData });
  return blobId;
}

export async function decryptAnnotationsBlob(params: {
  encryptedData: string;
  formId: string;
  adminCapId: string;
  sessionKey: SessionKey;
}): Promise<AnnotationsBlob> {
  const plaintext = await decryptSubmission({ ...params });
  return JSON.parse(plaintext);
}
```

**Step 3: Add `annotations_blob_id` field to `Form` on-chain**

In `walform_contracts/sources/form.move`, add to the `Form` struct:
```move
annotations_blob_id: Option<vector<u8>>,
```
Add a new entry function:
```move
public fun update_annotations_blob(
    form: &mut Form,
    cap: &AdminCap,
    blob_id: vector<u8>,
) {
    assert!(cap.form_id == object::id(form), E_WRONG_CAP);
    form.annotations_blob_id = option::some(blob_id);
}
```

**Step 4: Rewrite `useAnnotations.ts`**

Replace the `localStorage` hook with a TanStack Query hook that:
- On mount: reads `form.annotations_blob_id`, fetches + decrypts the blob
- On `setStatus` / `setNote`: merges locally, re-encrypts, uploads new blob to Walrus, calls `update_annotations_blob` PTB on-chain to register the new blob ID
- Optimistic update the local query cache for instant UI feedback

```ts
export function useAnnotations(formId: string, adminCapId: string | null) {
  const queryClient = useQueryClient();
  const { data: form } = useFormDetail(formId);
  const { decrypt } = useDecrypt();

  const { data: annotations } = useQuery({
    queryKey: ['annotations', formId],
    queryFn: async () => {
      if (!form?.annotations_blob_id) return {};
      // fetch encrypted blob → decrypt → return Record<blobId, SubmissionAnnotation>
    },
    enabled: !!form && !!adminCapId,
  });

  const save = useMutation({
    mutationFn: async (updated: Record<string, SubmissionAnnotation>) => {
      // encrypt → upload → on-chain TX to register new blob ID
    },
    onMutate: (updated) => {
      queryClient.setQueryData(['annotations', formId], updated); // optimistic
    },
  });

  return { annotations, save };
}
```

**Redeploy contract** after the struct change (`sui client publish --gas-budget 100000000`), update `NEXT_PUBLIC_PACKAGE_ID` in `.env.local`.

---

## Fix 2 — File blobs show raw blobId, no preview (HIGH)

### What's broken
In `SubmissionDetail.tsx` lines 192–196, attached files only display a truncated `blobId` string.
No link, no image preview, no video player. Completely unusable for screenshots/videos — which are explicitly listed in the hackathon requirements.

```tsx
// Current — useless
<code className="text-xs font-mono text-slate-400">
  {fileBlobId.slice(0, 20)}…
</code>
```

### Why it matters for judges
Screenshot and video upload support is listed in the official requirements tweet. If a judge submits a screenshot and sees an unclickable hash, the feature is perceived as non-functional.

### How to fix — step by step

**Step 1: Store file MIME type alongside blobId in `SubmissionBlob`**

In `src/types/submission.ts`:
```ts
// Change from:
fileBlobs?: Record<string, string>;
// Change to:
fileBlobs?: Record<string, { blobId: string; mimeType: string; fileName: string }>;
```

**Step 2: Update `FileUploader.tsx`** — pass `file.type` and `file.name` to the callback:
```ts
// FileUploader already has File in onUploaded callback (line 32)
onUploaded(blobId, file); // file.type = mimeType, file.name = fileName
```

In the form fill page (`/f/[formId]/page.tsx`), update the handler:
```ts
onFileUploaded={(fieldId, blobId, file) => {
  setFileBlobs(prev => ({
    ...prev,
    [fieldId]: { blobId, mimeType: file.type, fileName: file.name }
  }));
}}
```

**Step 3: Create `src/components/dashboard/FileBlobPreview.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { getRandomAggregator } from '@/lib/walrus';

interface FileBlobPreviewProps {
  blobId: string;
  mimeType: string;
  fileName: string;
}

export function FileBlobPreview({ blobId, mimeType, fileName }: FileBlobPreviewProps) {
  const [revealed, setRevealed] = useState(false);
  const url = `${getRandomAggregator()}/v1/blobs/${blobId}`;

  if (!revealed) {
    return (
      <button onClick={() => setRevealed(true)}
        className="text-xs text-blue-600 underline">
        View {fileName}
      </button>
    );
  }

  if (mimeType.startsWith('image/')) {
    return <img src={url} alt={fileName} className="max-h-64 rounded-xl border" />;
  }
  if (mimeType.startsWith('video/')) {
    return <video src={url} controls className="max-h-64 w-full rounded-xl" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-xs text-blue-600 underline">
      Download {fileName} ↗
    </a>
  );
}
```

**Step 4: Replace the blobId display in `SubmissionDetail.tsx`** (lines 186–198):
```tsx
import { FileBlobPreview } from './FileBlobPreview';

{Object.entries(submission.fileBlobs).map(([key, fileInfo]) => (
  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-sm capitalize text-slate-600 mb-2">{key.replace(/_/g, ' ')}</p>
    <FileBlobPreview
      blobId={fileInfo.blobId}
      mimeType={fileInfo.mimeType}
      fileName={fileInfo.fileName}
    />
  </div>
))}
```

---

## Fix 3 — No sort / filter on submissions table (HIGH)

### What's broken
`SubmissionTable.tsx` renders `blobIds.reverse()` with zero filtering.
There is no way to filter by status, search by content, or sort by date.
The hackathon prompt says: *"sort through submissions, leave notes, prioritize what to act on"* — none of this is possible in the current UI.

**File:** `src/components/dashboard/SubmissionTable.tsx` — entire component.

### How to fix — step by step

**Step 1: Create a filter bar component `src/components/dashboard/SubmissionFilters.tsx`**

```tsx
'use client';

import type { SubmissionStatus } from '@/types/submission';

interface SubmissionFiltersProps {
  statusFilter: SubmissionStatus | 'all';
  onStatusChange: (s: SubmissionStatus | 'all') => void;
  sortOrder: 'newest' | 'oldest';
  onSortChange: (s: 'newest' | 'oldest') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalCount: number;
}

const STATUS_OPTIONS: Array<{ value: SubmissionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'spam', label: 'Spam' },
];

export function SubmissionFilters({
  statusFilter, onStatusChange,
  sortOrder, onSortChange,
  searchQuery, onSearchChange,
  totalCount,
}: SubmissionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Status pills */}
      <div className="flex gap-1.5">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button key={value} onClick={() => onStatusChange(value)}
            className={statusFilter === value
              ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white'
              : 'rounded-full border px-3 py-1 text-xs font-bold text-slate-500 hover:border-slate-400'
            }>
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select value={sortOrder} onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest')}
        className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-600">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>

      {/* Search */}
      <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search submissions…"
        className="rounded-xl border px-3 py-1.5 text-xs flex-1 min-w-[180px]" />

      <span className="ml-auto text-xs text-slate-400">{totalCount} result(s)</span>
    </div>
  );
}
```

**Step 2: Add filter state and logic to `SubmissionTable.tsx`**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useSubmission } from '@/hooks/useSubmissions';
import { SubmissionFilters } from './SubmissionFilters';
import type { SubmissionStatus } from '@/types/submission';

export function SubmissionTable({ blobIds, formId, onViewDetail }) {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const { getAnnotation } = useAnnotations(formId);

  // Note: search only works on plain fields since encrypted fields need a session key.
  // Filtering by status uses annotations which are already in memory.

  const filteredIds = useMemo(() => {
    let ids = [...blobIds];

    // Sort by index position as proxy for submission time
    if (sortOrder === 'oldest') ids = ids; // already oldest-first
    else ids = ids.reverse();

    // Filter by status using annotations
    if (statusFilter !== 'all') {
      ids = ids.filter((id) => getAnnotation(id).status === statusFilter);
    }

    return ids;
  }, [blobIds, statusFilter, sortOrder, getAnnotation]);

  return (
    <div>
      <SubmissionFilters
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        sortOrder={sortOrder} onSortChange={setSortOrder}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        totalCount={filteredIds.length}
      />
      {filteredIds.length === 0 ? (
        <EmptyState ... />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredIds.map((blobId, i) => (
            <SubmissionRow key={blobId} index={i} blobId={blobId}
              formId={formId} onViewDetail={onViewDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Fix 4 — No CSV export (HIGH — explicitly required by hackathon)

### What's broken
There is no export feature anywhere in the codebase. The hackathon bonus points section explicitly asks for *"export the data"*. This is a quick win that judges will check.

### How to fix — step by step

**Step 1: Create `src/lib/export.ts`**

```ts
import type { SubmissionBlob } from '@/types/submission';
import type { FormConfig } from '@/types/form';

export function exportToCSV(params: {
  submissions: Array<{ blobId: string; blob: SubmissionBlob; decryptedFields?: Record<string, unknown> }>;
  formConfig: FormConfig;
  fileName?: string;
}): void {
  const { submissions, formConfig, fileName } = params;

  // Build ordered column headers from form field definitions
  const fieldHeaders = formConfig.fields.map((f) => f.label);
  const headers = ['#', 'Submitted At', 'Blob ID', ...fieldHeaders, 'Status', 'Note'];

  const rows = submissions.map((s, i) => {
    const allFields = {
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
```

**Step 2: Add Export button to `src/app/forms/[formId]/page.tsx`**

In the hero card actions section (around line 233), add:

```tsx
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

// Inside FormDetailContent, after decrypting submissions:
async function handleExport() {
  // 1. For each blobId in index, download the blob (already cached by TanStack Query)
  // 2. Prompt admin to decrypt (reuse existing decrypt flow / session key)
  // 3. Call exportToCSV()
  // Simple version: export only plain fields without needing decryption
  const submissions = blobIds.map((id) => ({
    blobId: id,
    blob: queryClient.getQueryData<SubmissionBlob>(['submission', id])!,
    annotation: getAnnotation(id),
  })).filter((s) => !!s.blob);

  exportToCSV({ submissions, formConfig: config!, fileName: `${form.title}.csv` });
  toast.success(`Exported ${submissions.length} submissions`);
}

// In JSX:
<button onClick={handleExport} className="...">
  <Download className="size-4" />
  Export CSV
</button>
```

**Step 3 (optional, impressive): Decrypt-all-then-export flow**

Add a modal with a warning: *"Exporting will decrypt all encrypted fields. This requires your wallet signature."*
Reuse `useDecrypt` hook in a loop over all submissions before calling `exportToCSV`.

---

## Fix 5 — Priority field missing from submissions (MEDIUM)

### What's broken
`SubmissionAnnotation` in `src/types/submission.ts` only has `status` (new/in_progress/resolved/spam) and `note`.
The hackathon prompt says *"prioritize what to act on"* — there is no severity/priority dimension.
Status and priority are different concepts: a bug can be `new` but `critical`, or `in_progress` but `low`.

**File:** `src/types/submission.ts` lines 18–24

```ts
// Current — no priority field
export interface SubmissionAnnotation {
  status: SubmissionStatus;
  note: string;
  updatedAt: number;
}
```

### How to fix — step by step

**Step 1: Add `SubmissionPriority` type to `src/types/submission.ts`**

```ts
export type SubmissionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SubmissionAnnotation {
  status: SubmissionStatus;
  priority: SubmissionPriority;  // NEW
  note: string;
  updatedAt: number;
}
```

**Step 2: Update `useAnnotations.ts`** — set default priority:
```ts
const getAnnotation = useCallback((blobId: string): SubmissionAnnotation => {
  return readAll(formId)[blobId] ?? {
    status: 'new',
    priority: 'medium',  // NEW default
    note: '',
    updatedAt: 0,
  };
}, [formId]);

// Add new setter:
const setPriority = useCallback((blobId: string, priority: SubmissionPriority) => {
  const all = readAll(formId);
  all[blobId] = { ...getAnnotation(blobId), priority, updatedAt: Date.now() };
  writeAll(formId, all);
}, [formId, getAnnotation]);
```

**Step 3: Add priority selector in `SubmissionDetail.tsx`** — place after the status selector section (around line 203):

```tsx
const PRIORITY_CONFIG = {
  critical: { label: '🔴 Critical', active: 'bg-rose-600 text-white', inactive: 'border-rose-200 text-rose-700' },
  high:     { label: '🟠 High',     active: 'bg-orange-500 text-white', inactive: 'border-orange-200 text-orange-700' },
  medium:   { label: '🟡 Medium',   active: 'bg-amber-400 text-white',  inactive: 'border-amber-200 text-amber-700' },
  low:      { label: '🟢 Low',      active: 'bg-emerald-500 text-white', inactive: 'border-emerald-200 text-emerald-700' },
};

// In JSX, below Status section:
<section>
  <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Priority</h3>
  <div className="flex flex-wrap gap-2">
    {(['critical', 'high', 'medium', 'low'] as SubmissionPriority[]).map((p) => {
      const cfg = PRIORITY_CONFIG[p];
      const isActive = annotation.priority === p;
      return (
        <button key={p} onClick={() => setPriority(blobId, p)}
          className={['rounded-2xl border px-4 py-2 text-sm font-extrabold transition',
            isActive ? cfg.active : cfg.inactive].join(' ')}>
          {cfg.label}
        </button>
      );
    })}
  </div>
</section>
```

**Step 4: Display priority badge in `SubmissionRow.tsx`** alongside the status badge:

```tsx
import { PriorityBadge } from './PriorityBadge'; // new small component

// In SubmissionRow, top row:
<div className="flex items-start justify-between gap-3">
  <span className="...">#{index + 1}</span>
  <div className="flex gap-1.5">
    <PriorityBadge priority={annotation.priority} />
    <StatusBadge status={annotation.status} />
  </div>
</div>
```

**Step 5: Add priority filter to `SubmissionFilters.tsx`** (from Fix 3):

```tsx
// Add priority filter state in SubmissionTable:
const [priorityFilter, setPriorityFilter] = useState<SubmissionPriority | 'all'>('all');

// Add to filter logic in useMemo:
if (priorityFilter !== 'all') {
  ids = ids.filter((id) => getAnnotation(id).priority === priorityFilter);
}
```

---

## Summary

| # | Fix | Files to change | Effort | Judge Impact |
|---|-----|----------------|--------|--------------|
| 1 | Annotations → Walrus (not localStorage) | `types/submission.ts`, new `lib/annotations.ts`, `hooks/useAnnotations.ts`, `form.move`, re-deploy | 4–6h | Critical |
| 2 | File preview (image/video/download) | `types/submission.ts`, `FileUploader.tsx`, new `FileBlobPreview.tsx`, `SubmissionDetail.tsx` | 1–2h | High |
| 3 | Sort/filter submissions | new `SubmissionFilters.tsx`, `SubmissionTable.tsx` | 1–2h | High |
| 4 | Export CSV | new `lib/export.ts`, `forms/[formId]/page.tsx` | 1h | High |
| 5 | Priority field | `types/submission.ts`, `useAnnotations.ts`, `SubmissionDetail.tsx`, `SubmissionRow.tsx` | 1h | Medium |

**Recommended order:** Fix 4 → Fix 2 → Fix 3 → Fix 5 → Fix 1
(Start with quick wins 4, 2, 3 for visible feature coverage, then tackle 5 for completeness, finally Fix 1 for production credibility if time permits.)
