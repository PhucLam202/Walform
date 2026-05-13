# Phase 4 — Frontend UI

> **Mục tiêu:** Form Builder, Form Fill, Dashboard — demo-ready
> **Thời gian:** ~1 ngày
> **Cần trước:** Phase 3 hoàn thành (lib/ layer E2E pass)
> **Status:** ⬜ TODO

---

## Thứ tự build (P0 trước, P1 sau)

```
4.1 store/builder.ts (state)
4.2 /builder page (form builder UI)
4.3 /f/[formId] page (public form fill)
4.4 /dashboard page (creator list forms)
4.5 /forms/[formId] page (dashboard detail + decrypt)
4.6 Templates
4.7 Polish checklist
```

---

## 4.1 Builder Store

**`src/store/builder.ts`:**

```typescript
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { FormField, FormConfig, FieldType } from '@/types/form';

interface BuilderStore {
  config: FormConfig;
  setTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setFormType: (type: string) => void;
  addField: (type: FieldType) => void;
  removeField: (id: string) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  reorderFields: (fromIdx: number, toIdx: number) => void;
  loadTemplate: (template: Partial<FormConfig>) => void;
  reset: () => void;
}

const defaultConfig = (): FormConfig => ({
  id: nanoid(),
  title: '',
  description: '',
  form_type: 'custom',
  version: 0,
  fields: [],
  sensitiveFieldIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useBuilderStore = create<BuilderStore>((set) => ({
  config: defaultConfig(),

  setTitle: (title) => set(s => ({ config: { ...s.config, title } })),
  setDescription: (description) => set(s => ({ config: { ...s.config, description } })),
  setFormType: (form_type) => set(s => ({ config: { ...s.config, form_type } })),

  addField: (type) => set(s => {
    const order = s.config.fields.length;
    const newField: FormField = {
      id: nanoid(),
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} field`,
      isSensitive: type === 'email',
      options: ['dropdown','checkbox','radio'].includes(type) ? ['Option 1','Option 2'] : undefined,
      validation: { required: false },
      order,
    };
    return { config: { ...s.config, fields: [...s.config.fields, newField] } };
  }),

  removeField: (id) => set(s => ({
    config: { ...s.config, fields: s.config.fields.filter(f => f.id !== id) }
  })),

  updateField: (id, updates) => set(s => ({
    config: {
      ...s.config,
      fields: s.config.fields.map(f => f.id === id ? { ...f, ...updates } : f),
      sensitiveFieldIds: updates.isSensitive !== undefined
        ? updates.isSensitive
          ? [...new Set([...s.config.sensitiveFieldIds, id])]
          : s.config.sensitiveFieldIds.filter(sid => sid !== id)
        : s.config.sensitiveFieldIds,
    }
  })),

  reorderFields: (fromIdx, toIdx) => set(s => {
    const fields = [...s.config.fields];
    const [moved] = fields.splice(fromIdx, 1);
    fields.splice(toIdx, 0, moved);
    return { config: { ...s.config, fields: fields.map((f, i) => ({ ...f, order: i })) } };
  }),

  loadTemplate: (template) => set(s => ({
    config: { ...defaultConfig(), ...template, fields: (template.fields ?? []).map((f, i) => ({ ...f, id: nanoid(), order: i })) }
  })),

  reset: () => set({ config: defaultConfig() }),
}));
```

- [ ] store/builder.ts tạo xong

---

## 4.2 Form Builder `/builder`

**Components cần build (theo thứ tự):**

### `FieldPalette.tsx`
- Grid 3 cột các field types
- Mỗi button: icon (lucide) + label
- Click → `addField(type)`
- Types: text, textarea, dropdown, checkbox, radio, rating, url, email, file

### `FieldEditor.tsx`
- Click vào field → expand inline settings
- Toggle required (switch)
- Toggle sensitive (lock icon, badge "🔒 Encrypted")
- Edit label (input)
- Edit placeholder (input)
- Edit options (cho dropdown/checkbox/radio — comma-separated)
- Delete button (trash icon, đỏ)

### `FormCanvas.tsx`
- List của FieldEditor, có drag handle
- dnd-kit `SortableContext` + `DndContext`
- Empty state: "Add your first field →"

### `FormPreview.tsx`
- Render form như responder sẽ thấy
- Show "🔒 Encrypted" badge trên sensitive fields

### Builder page `src/app/builder/page.tsx`
- Layout: Left sidebar (FieldPalette) | Center (FormCanvas) | Right tab (Preview)
- Header: Title input, Description input, Form type select, Template picker
- Footer: "Publish" button

**Publish flow:**
```typescript
const handlePublish = async () => {
  setLoading(true);
  try {
    // 1. Upload config lên Walrus
    const { blobId } = await uploadJSON(config);
    // 2. Build TX
    const tx = buildCreateFormTx({ title, description, formType, configBlobId: blobId });
    // 3. Sign + Execute
    const res = await signAndExecuteTransaction({ transaction: tx });
    // 4. Extract IDs
    const { formId } = extractFormAndCap(res);
    // 5. Redirect
    router.push(`/forms/${formId}`);
  } catch (e) {
    toast.error('Publish failed: ' + e.message);
  } finally {
    setLoading(false);
  }
};
```

- [ ] FieldPalette component
- [ ] FieldEditor component
- [ ] FormCanvas với drag-drop
- [ ] FormPreview component
- [ ] Builder page layout
- [ ] Publish flow hoạt động

---

## 4.3 Form Fill `/f/[formId]`

**`src/app/f/[formId]/page.tsx`**

```typescript
// Flow:
// 1. Fetch Form object từ Sui → config_blob_id
// 2. Download FormConfig từ Walrus
// 3. Render fields
// 4. On submit:
//    a. Validate required fields
//    b. Handle file uploads → Walrus blobs
//    c. Separate sensitive vs plain
//    d. Encrypt sensitive với Seal
//    e. Bundle SubmissionBlob → upload Walrus
//    f. POST /api/notify-submission
//    g. Show success screen
```

**Key components:**

### `FieldRenderer.tsx`
- Switch trên `field.type` → render đúng input component
- text → `<Input>`
- textarea → `<Textarea>`
- dropdown → `<Select>`
- checkbox → list of `<Checkbox>`
- radio → list of `<RadioGroup>`
- rating → 5-star click component
- url/email → `<Input type="url/email">`
- file → `<FileUploader>`

### `FileUploader.tsx`
- Drag & drop zone
- Progress bar (dùng XMLHttpRequest `uploadLargeFile`)
- Preview thumbnail cho images
- Lưu blobId vào form state

**Submit handler:**
```typescript
const handleSubmit = async (data: Record<string, unknown>) => {
  setSubmitting(true);
  // file fields đã có blobId từ FileUploader
  const fileBlobs: Record<string, string> = {};
  // collect file blobIds từ data

  // Separate sensitive vs plain
  const sensitiveKeys = config.sensitiveFieldIds;
  const sensitiveData: Record<string, unknown> = {};
  const plainData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (sensitiveKeys.includes(k)) sensitiveData[k] = v;
    else plainData[k] = v;
  }

  // Encrypt
  let encryptedFields: string | undefined;
  let sealRef: string | undefined;
  if (Object.keys(sensitiveData).length > 0) {
    const result = await encryptForForm({
      sealClient: getSealClient(),
      formId: form.id,
      data: JSON.stringify(sensitiveData),
    });
    encryptedFields = result.encryptedData;
    sealRef = result.sealRef;
  }

  // Upload submission blob
  const submissionBlobId = await uploadSubmissionBlob({
    formId: form.id,
    formVersion: form.version,
    submittedAt: Date.now(),
    plainFields: plainData,
    encryptedFields,
    sealRef,
    fileBlobs,
  });

  // Notify
  await fetch('/api/notify-submission', {
    method: 'POST',
    body: JSON.stringify({ formId: form.id, submissionBlobId }),
    headers: { 'Content-Type': 'application/json' },
  });

  setSubmitted(true);
};
```

- [ ] FieldRenderer cho tất cả field types
- [ ] FileUploader với progress
- [ ] Submit flow hoàn chỉnh
- [ ] Success screen

---

## 4.4 Dashboard `/dashboard`

**`src/app/dashboard/page.tsx`**

- Guard: redirect nếu không có wallet connected
- Fetch owned forms: `getOwnedForms(address)`
- Grid hoặc list của FormCard

### `FormCard.tsx`
- Title, form_type badge, created_at
- Status badge: Active (green) / Closed (red)
- Response count (`submission_count` — approximate)
- Click → `/forms/[formId]`
- Share link button (copy `/f/[formId]` to clipboard)

- [ ] Dashboard page
- [ ] FormCard component

---

## 4.5 Dashboard Detail `/forms/[formId]`

**Layout:**
```
Header: title | status badge | Toggle Active button | Share link
Stats: Total submissions (từ index.blobIds.length)
Tabs: [Submissions] [Settings]

Submissions tab:
├── "Sync pending submissions" button (fetch /api/pending-submissions → update index)
├── Filter: All | New | In Progress | Resolved | Spam
├── SubmissionTable
└── SubmissionDetail (modal)
```

### `SubmissionTable.tsx`
- Columns: # | Submitted at | Status | Plain preview | Actions
- "Decrypt & View" button per row
- Bulk select checkbox

### `SubmissionDetail.tsx`
- Plain fields: hiển thị ngay
- Encrypted fields: "🔒 Click to decrypt"
- Decrypt button → `createCreatorSessionKey` → `decryptSubmission`
- Status dropdown (localStorage)
- Private note textarea (localStorage)

### Sync pending flow:
```typescript
const handleSync = async () => {
  // 1. Fetch pending blobIds
  const { blobIds } = await fetch(`/api/pending-submissions?formId=${formId}`).then(r => r.json());
  if (!blobIds.length) return;

  // 2. Append tất cả vào index
  let indexBlobId = form.submissions_index_blob_id;
  for (const blobId of blobIds) {
    indexBlobId = await appendToSubmissionIndex({
      currentIndexBlobId: indexBlobId,
      newSubmissionBlobId: blobId,
      formId,
    });
  }

  // 3. Update on-chain
  const tx = buildUpdateSubmissionsIndexTx({ formObjectId: formId, adminCapId, indexBlobId: indexBlobId! });
  await signAndExecuteTransaction({ transaction: tx });

  // 4. Clear pending
  await fetch(`/api/pending-submissions?formId=${formId}`, { method: 'DELETE' });

  // 5. Refresh
  refetch();
};
```

- [ ] SubmissionTable component
- [ ] SubmissionDetail modal với decrypt
- [ ] Sync pending button
- [ ] Status + note lưu localStorage

---

## 4.6 Templates

**`src/lib/templates.ts`** — 5 templates:
- `bug_report`: Title, Severity, Steps, Screenshot, Contact email (sensitive)
- `feature_request`: Feature name, Problem, Solution, Priority rating, Email (sensitive)
- `office_hours`: Name, What built, Experience rating, Feedback, Project URL
- `survey`: Topic, Questions, Rating, Suggestions
- `job_application`: Name, Position, Resume (file, sensitive), Cover letter, Portfolio URL

Template picker trong builder → `loadTemplate(TEMPLATES.bug_report)`.

- [ ] 5 templates implement

---

## 4.7 Polish Checklist

- [ ] Loading skeleton cho tất cả data fetch
- [ ] Error toast với retry button
- [ ] Empty states với illustration text
- [ ] Mobile responsive (test 375px)
- [ ] Copy to clipboard toast (share link)
- [ ] `npm run build` — zero build errors
- [ ] `npm run lint` — zero lint errors

---

## 4.8 Pre-Deploy Checklist

```bash
# Switch env sang mainnet
# Cập nhật .env.local: NEXT_PUBLIC_SUI_NETWORK=mainnet
# Cập nhật Walrus endpoints sang mainnet
# Deploy Move package lên mainnet (copy packageId)

sui client switch --env mainnet
sui client publish --gas-budget 300000000

# Update .env.local với mainnet packageId
# Deploy lên Vercel
vercel --prod
```

- [ ] Move re-deploy trên mainnet
- [ ] `.env.local` cập nhật mainnet IDs
- [ ] `vercel --prod` thành công
- [ ] Vercel KV setup cho API routes (Vercel dashboard → Storage → KV)
- [ ] Test tạo form trên mainnet
- [ ] Test submit response trên mainnet
- [ ] Test decrypt trên mainnet

---

## ✅ Checkpoint Phase 4

- [ ] Builder: tạo form, drag-drop, preview, publish hoạt động
- [ ] Form fill: render đúng fields, submit, file upload
- [ ] Dashboard: list forms, view submissions
- [ ] Decrypt: creator decrypt sensitive fields thành công
- [ ] Sync pending: submissions merge vào index
- [ ] `npm run build` — pass
- [ ] Deploy mainnet — pass

**Done → xem [../phases/README.md](./README.md) để đổi tất cả status → ✅ DONE**
**Sau đó: quay video demo và nộp DeepSurge!**
