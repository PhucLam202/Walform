# BUILD PLAN — WalForm
> Solo · 12 ngày · Mainnet Deadline 18/5/2026

---

## Timeline Tổng Quan

```
Day 1-2  │ Setup + Move contracts
Day 3-4  │ Walrus + Seal integration
Day 5-6  │ Form Builder UI
Day 7-8  │ Form Fill page + Submit flow
Day 9-10 │ Dashboard + Decrypt
Day 11   │ Polish + Templates
Day 12   │ Deploy + Record demo + Submit
```

---

## Day 1 — Project Setup

### Mục tiêu: Chạy được app với wallet connect

```bash
# 1. Tạo Next.js project
npx create-next-app@latest walform \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*"

cd walform

# 2. Install dependencies
npm install @mysten/sui @mysten/dapp-kit @mysten/walrus @mysten/seal
npm install @tanstack/react-query zustand
npm install react-hook-form zod @hookform/resolvers
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install lucide-react class-variance-authority clsx tailwind-merge

# 3. Init shadcn
npx shadcn@latest init
# Chọn: Default style, Slate base color, CSS variables

# 4. Add shadcn components cần dùng
npx shadcn@latest add button card input textarea label
npx shadcn@latest add select checkbox badge dialog sheet
npx shadcn@latest add table tabs toast progress separator
```

### Cấu hình providers (`src/app/providers.tsx`):
```typescript
'use client';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
const networks = { mainnet: { url: getFullnodeUrl('mainnet') } };

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="mainnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

**Checkpoint Day 1:** App chạy, connect Sui Wallet được ✓

---

## Day 2 — Move Contracts

### Mục tiêu: Publish package lên Mainnet

```bash
# Cài Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git sui

# Tạo Move project
sui move new walform-contracts
cd walform-contracts
```

### File `Move.toml`:
```toml
[package]
name = "walform"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }
Seal = { git = "https://github.com/MystenLabs/seal.git", subdir = "move/seal", rev = "main" }

[addresses]
walform = "0x0"
```

### Implement 3 files Move (xem ARCHITECTURE.md)

### Publish:
```bash
sui client switch --env mainnet
sui client publish --gas-budget 100000000

# Copy output:
# Package ID: 0x...
# Form type: 0x..::form::Form
```

**Checkpoint Day 2:** Package deployed, copy packageId vào `.env.local` ✓

---

## Day 3 — Walrus Integration

### Mục tiêu: Upload và download JSON blob

Tạo `src/lib/walrus.ts`:
```typescript
const PUBLISHER = 'https://publisher.walrus-mainnet.walrus.space';
const AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space';

export interface WalrusUploadResult {
  blobId: string;
  isNew: boolean;
}

export async function uploadBlob(
  data: string | Blob,
  mimeType = 'application/json'
): Promise<WalrusUploadResult> {
  const body = typeof data === 'string' 
    ? new Blob([data], { type: mimeType }) 
    : data;
  
  const res = await fetch(`${PUBLISHER}/v1/store?epochs=12`, {
    method: 'PUT',
    body,
  });

  if (!res.ok) throw new Error(`Walrus upload failed: ${res.status}`);
  
  const result = await res.json();
  const blobId = result.newlyCreated?.blobObject?.blobId 
               ?? result.alreadyCertified?.blobId;

  if (!blobId) throw new Error('No blobId returned');
  return { blobId, isNew: !!result.newlyCreated };
}

export async function downloadBlob<T>(blobId: string): Promise<T> {
  const res = await fetch(`${AGGREGATOR}/v1/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download failed: ${res.status}`);
  return res.json();
}
```

### Test upload trong component tạm:
```typescript
// Test nhanh
const result = await uploadBlob(JSON.stringify({ test: true }));
console.log('blobId:', result.blobId); // Kiểm tra trên browser
```

**Checkpoint Day 3:** Upload/download Walrus thành công ✓

---

## Day 4 — Seal Integration + Contracts Helper

### Mục tiêu: Encrypt/decrypt data + Move call helpers

Tạo `src/lib/seal.ts`:
```typescript
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';

// Mainnet verified key servers (từ seal-docs.wal.app)
const KEY_SERVERS = [
  { objectId: '0x...', weight: 1 },  // Ruby Nodes
  { objectId: '0x...', weight: 1 },  // NodeInfra
  // ... thêm từ docs
];

export function createSealClient(suiClient: SuiClient) {
  return new SealClient({
    suiClient,
    serverObjectIds: KEY_SERVERS,
    verifyKeyServers: false, // true sau khi test xong
  });
}

export async function encryptData(
  sealClient: SealClient,
  packageId: string,
  formId: string,
  data: string
): Promise<{ encryptedData: Uint8Array; encryptedKey: Uint8Array }> {
  const { encryptedObject, key } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: formId,
    data: new TextEncoder().encode(data),
  });
  return { encryptedData: encryptedObject, encryptedKey: key };
}

export async function decryptData(
  sealClient: SealClient,
  txBytes: Uint8Array,
  sessionKey: SessionKey,
  encryptedData: Uint8Array
): Promise<string> {
  const decrypted = await sealClient.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });
  return new TextDecoder().decode(decrypted);
}
```

Tạo `src/lib/contracts.ts`:
```typescript
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from './constants';

export function buildCreateFormTx(
  blobId: string,
  title: string,
  description: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::create_form`,
    arguments: [
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.vector('u8', Array.from(Buffer.from(blobId))),
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}
```

**Checkpoint Day 4:** Encrypt → Upload → Download → Decrypt round-trip thành công ✓

---

## Day 5-6 — Form Builder UI

### Mục tiêu: Builder kéo-thả hoàn chỉnh với Preview

### Field Types (TypeScript):
```typescript
// src/types/form.ts
export type FieldType = 
  | 'text' | 'textarea' | 'dropdown' 
  | 'checkbox' | 'rating' | 'url' | 'file';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  isSensitive: boolean;          // Seal encrypt này không?
  options?: string[];            // cho dropdown/checkbox
}

export interface FormConfig {
  id: string;                    // nanoid
  title: string;
  description: string;
  fields: FormField[];
  sensitiveFieldIds: string[];
  createdAt: number;
}
```

### Builder Store (Zustand):
```typescript
// src/store/builder.ts
import { create } from 'zustand';
import { FormField, FormConfig } from '@/types/form';
import { nanoid } from 'nanoid';

interface BuilderState {
  config: FormConfig;
  addField: (type: FieldType) => void;
  removeField: (id: string) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  reorderFields: (oldIdx: number, newIdx: number) => void;
  setTitle: (title: string) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  config: {
    id: nanoid(),
    title: '',
    description: '',
    fields: [],
    sensitiveFieldIds: [],
    createdAt: Date.now(),
  },
  addField: (type) => set((state) => ({
    config: {
      ...state.config,
      fields: [...state.config.fields, {
        id: nanoid(),
        type,
        label: `New ${type} field`,
        required: false,
        isSensitive: false,
      }],
    },
  })),
  // ... other actions
}));
```

### Components cần build (Day 5-6):

**`FormCanvas.tsx`** — Drop zone với dnd-kit:
- Render list of FieldEditor components
- Drag handle trái, delete button phải
- Empty state với illustration

**`FieldPalette.tsx`** — Sidebar trái:
- Button cho từng field type với icon (lucide)
- Click → addField

**`FieldEditor.tsx`** — Inline edit:
- Click vào field → expand settings
- Toggle required, toggle sensitive (lock icon)
- Edit label, placeholder

**`FormPreview.tsx`** — Tab "Preview":
- Render actual form (dùng lại FieldRenderer)
- Show "sensitive" badge trên encrypted fields

**Checkpoint Day 6:** Builder hoàn chỉnh, preview đúng, Publish flow mock ✓

---

## Day 7-8 — Form Fill Page + Submit

### Mục tiêu: Public form fill, submit lên Walrus

`src/app/f/[formId]/page.tsx`:
```typescript
// Flow:
// 1. Fetch formConfig từ Walrus (blobId từ Sui object)
// 2. Render form với FieldRenderer
// 3. On submit:
//    a. Separate sensitive vs plain fields
//    b. Encrypt sensitive fields với Seal
//    c. Handle file uploads → Walrus blobs
//    d. Bundle thành SubmissionBlob JSON
//    e. Upload lên Walrus → blobId
//    f. Show success screen
```

### File Upload với Progress:
```typescript
// src/components/form/FileUploader.tsx
export function FileUploader({ onUpload }: { onUpload: (blobId: string) => void }) {
  const [progress, setProgress] = useState(0);
  
  const handleFile = async (file: File) => {
    // Dùng XMLHttpRequest để track progress
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      setProgress(Math.round((e.loaded / e.total) * 100));
    };
    // ... upload logic
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {progress > 0 && <Progress value={progress} />}
    </div>
  );
}
```

**Checkpoint Day 8:** Submit form → blob lên Walrus → success screen ✓

---

## Day 9-10 — Dashboard

### Mục tiêu: Dashboard creator với decrypt

**Dashboard layout:**
```
/dashboard
├── Sidebar: list forms (FormCard)
└── Main:
    ├── Form stats (response count, created date)
    ├── SubmissionTable (list submissions)
    └── SubmissionDetail (modal: decrypt & view)
```

### Query submissions:
```typescript
// src/hooks/useSubmissions.ts
export function useSubmissions(formId: string) {
  return useQuery({
    queryKey: ['submissions', formId],
    queryFn: async () => {
      // Fetch submission blobIds từ form's submissions index blob
      const form = await getFormObject(formId);
      const index = await downloadBlob<SubmissionIndex>(form.submissions_index_blob_id);
      return Promise.all(index.blobIds.map(downloadBlob<SubmissionBlob>));
    },
  });
}
```

### Decrypt flow trong SubmissionDetail:
```typescript
const handleDecrypt = async (submission: SubmissionBlob) => {
  const sessionKey = await sealClient.createSessionKey({
    packageId: PACKAGE_ID,
    id: formId,
    signer: wallet,
  });
  const plain = await decryptData(
    sealClient,
    txBytes,
    sessionKey,
    submission.encryptedData
  );
  setDecryptedContent(JSON.parse(plain));
};
```

**Checkpoint Day 10:** Dashboard functional, decrypt working ✓

---

## Day 11 — Templates + Polish

### Templates (30 phút mỗi cái):
```typescript
// src/lib/templates.ts
export const TEMPLATES = {
  bug_report: {
    title: 'Bug Report',
    fields: [
      { type: 'text', label: 'Title', required: true, isSensitive: false },
      { type: 'dropdown', label: 'Severity', options: ['Critical', 'High', 'Medium', 'Low'], required: true },
      { type: 'textarea', label: 'Steps to reproduce', required: true, isSensitive: false },
      { type: 'file', label: 'Screenshot', required: false, isSensitive: false },
      { type: 'text', label: 'Contact email', required: false, isSensitive: true }, // encrypted
    ],
  },
  feature_request: { ... },
  job_application: { ... },
  survey: { ... },
  office_hours: { ... }, // Walrus team sẽ dùng cái này!
};
```

### Polish checklist:
- [ ] Loading states cho tất cả async operations
- [ ] Error states với retry button
- [ ] Empty states với illustration
- [ ] Share link copy button
- [ ] Toast notifications (success/error)
- [ ] Mobile responsive check
- [ ] README.md viết rõ ràng

---

## Day 12 — Deploy + Demo + Submit

### Deploy Move (nếu chưa):
```bash
sui client publish --gas-budget 100000000
```

### Deploy Frontend:
```bash
# Update .env.local với mainnet IDs
vercel --prod
```

### Record Demo Video (< 3 phút):
```
Script video:
0:00-0:20  Mở WalForm, giới thiệu nhanh
0:20-0:50  Tạo form "Office Hours Feedback" với template
0:50-1:20  Fill form với screenshot + sensitive email
1:20-1:50  Dashboard: xem submission, click Decrypt
1:50-2:20  Export CSV, show form share link
2:20-2:50  Mention: Walrus blob IDs, Seal encryption, Sui objects
2:50-3:00  CTA: link deploy + repo
```

### Upload video:
```
Dùng chính WalForm để upload video → blobId
Đây là "dogfooding" mà judge thích nhất
```

### Nộp bài DeepSurge:
```
URL: https://deepsurge.xyz/hackathons/c2c48b38-33a7-405c-922b-a3be2ad25158

Cần:
- Link repo GitHub (public)
- Mô tả ngắn (3-5 câu)
- Video blob ID (Walrus)
- Deploy URL
```

### Post on X:
```
Template:
Excited to submit WalForm to @WalrusProtocol Session 2!

Form & feedback platform built natively on Walrus + Sui:
✅ All submissions stored on Walrus
🔐 Sensitive data encrypted with Seal
📊 Creator dashboard with decrypt on-demand

Built in 12 days solo 🔥

[deploy link] | [github link]

#WalrusSession2 @walgo_xyz
```

---

## Reference Links

| Resource | URL |
|----------|-----|
| Walrus Docs | https://docs.wal.app |
| Seal Docs | https://seal-docs.wal.app |
| Seal GitHub | https://github.com/MystenLabs/seal |
| Walrus HTTP API | https://docs.wal.app/usage/web-api.html |
| Sui Move Book | https://move-book.com |
| dApp Kit Docs | https://sdk.mystenlabs.com/dapp-kit |
| DeepSurge Submit | https://deepsurge.xyz/hackathons/c2c48b38-33a7-405c-922b-a3be2ad25158 |
| shadcn/ui | https://ui.shadcn.com |
| dnd-kit | https://dndkit.com |

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Seal SDK API thay đổi | Đọc examples/move repo trước, test early |
| Walrus upload chậm | Show progress bar, retry logic |
| Move compile error | Start Day 2, có 1 ngày buffer |
| Deadline 18/5 sát | Cut feature scope theo P0 first |
| Solo burnout | Day 11 chỉ polish, không add feature mới |
