# Phase 0 — Project Setup

> **Mục tiêu:** App chạy được, connect wallet, Move package tạo xong
> **Thời gian:** ~1h
> **Status:** ⬜ TODO

---

## 0.1 Tạo Next.js App

```bash
cd /Users/cps/Code/Personal-Project/hackathon/Sui/WalrusSS2

npx create-next-app@latest walform \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --no-git
```

- [ ] App tạo thành công tại `walform/`

---

## 0.2 Cài Dependencies

```bash
cd walform

npm install @mysten/sui @mysten/dapp-kit @mysten/walrus @mysten/seal
npm install @tanstack/react-query zustand nanoid
npm install react-hook-form zod @hookform/resolvers
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install @vercel/kv

npx shadcn@latest init
# Chọn: Default style · Slate base color · CSS variables: yes

npx shadcn@latest add button card input textarea label
npx shadcn@latest add select checkbox badge dialog sheet
npx shadcn@latest add table tabs toast progress separator
```

- [ ] `npm install` không có error
- [ ] shadcn init thành công

---

## 0.3 Tạo Providers

Tạo `src/app/providers.tsx`:

```typescript
'use client';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();
const networks = {
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

Cập nhật `src/app/layout.tsx` — wrap `{children}` trong `<Providers>`.

- [ ] Providers được mount trong layout.tsx

---

## 0.4 Tạo Move Package

```bash
cd /Users/cps/Code/Personal-Project/hackathon/Sui/WalrusSS2

sui move new walform-contracts
```

Thay toàn bộ `walform-contracts/Move.toml`:

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

Tạo 2 file sources (rỗng để build pass):
- `walform-contracts/sources/form.move` — `module walform::form {}`
- `walform-contracts/sources/policy.move` — `module walform::policy {}`

```bash
cd walform-contracts
sui move build
```

- [ ] `sui move build` pass (dù code rỗng)

---

## 0.5 Tạo `.env.local`

Tạo `walform/.env.local`:

```bash
# Network (dùng testnet khi dev, mainnet khi deploy)
NEXT_PUBLIC_SUI_NETWORK=testnet

# Move Package — điền sau khi publish (Phase 1)
NEXT_PUBLIC_PACKAGE_ID=0xTODO

# Seal — lấy từ https://seal-docs.wal.app (điền khi làm Phase 3)
NEXT_PUBLIC_SEAL_PACKAGE_ID=0xTODO
NEXT_PUBLIC_SEAL_SERVER_1=0xTODO
NEXT_PUBLIC_SEAL_SERVER_2=0xTODO
NEXT_PUBLIC_SEAL_THRESHOLD=2

# Walrus
NEXT_PUBLIC_WALRUS_PUBLISHER=https://walrus-testnet-publisher-1.staketab.org:443
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Vercel KV — điền khi setup Phase 3
KV_URL=TODO
KV_REST_API_URL=TODO
KV_REST_API_TOKEN=TODO
```

Tạo `walform/.env.example` (copy từ trên, thay values thành rỗng).

- [ ] `.env.local` tạo xong

---

## 0.6 Tạo Folder Structure (rỗng)

```bash
cd walform/src
mkdir -p lib hooks store types components/{builder,dashboard,form,ui} app/{dashboard,builder,forms,f}
touch lib/{walrus,seal,contracts,sui-client,constants,templates}.ts
touch types/{form,submission}.ts
touch store/builder.ts
touch hooks/{useForms,useSubmissions,useDecrypt}.ts
```

- [ ] Folder structure tạo xong

---

## 0.7 Tạo `src/lib/constants.ts`

```typescript
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
export const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID!;
export const SEAL_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_SEAL_THRESHOLD ?? '2');
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as 'mainnet' | 'testnet';

export const WALRUS_PUBLISHERS = [
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ?? 'https://walrus-testnet-publisher-1.staketab.org:443',
  'https://publisher.walrus-testnet.walrus.space',
];

export const WALRUS_AGGREGATORS = [
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space',
];

export const WALRUS_EPOCHS = 12;

// Điền sau Phase 1 (post deploy)
export const FORM_TYPE_NAME = `${PACKAGE_ID}::form::Form`;
export const ADMIN_CAP_TYPE_NAME = `${PACKAGE_ID}::form::AdminCap`;

export const SEAL_KEY_SERVERS: Array<{ objectId: string; weight: number }> = [
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_1 ?? '', weight: 1 },
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_2 ?? '', weight: 1 },
];
```

- [ ] constants.ts có đủ exports

---

## 0.8 Tạo `src/types/form.ts` và `src/types/submission.ts`

**`src/types/form.ts`:**
```typescript
export type FieldType =
  | 'text' | 'textarea' | 'dropdown' | 'checkbox'
  | 'radio' | 'rating' | 'url' | 'email' | 'file';

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  isSensitive: boolean;
  options?: string[];
  validation: FieldValidation;
  order: number;
}

export interface FormConfig {
  id: string;
  title: string;
  description: string;
  form_type: string;
  version: number;
  fields: FormField[];
  sensitiveFieldIds: string[];
  createdAt: number;
  updatedAt: number;
}

// Dữ liệu Form object trên Sui
export interface FormOnChain {
  id: string;
  owner: string;
  title: string;
  description: string;
  form_type: string;
  version: number;
  config_blob_id: string;
  submissions_index_blob_id: string | null;
  last_index_updated: number;
  is_active: boolean;
  submission_count: number;
  created_at: number;
}
```

**`src/types/submission.ts`:**
```typescript
export interface SubmissionBlob {
  formId: string;
  formVersion: number;
  submittedAt: number;
  plainFields: Record<string, unknown>;
  encryptedFields?: string;
  sealRef?: string;
  fileBlobs?: Record<string, string>;
}

export interface SubmissionIndex {
  formId: string;
  version: number;
  blobIds: string[];
  updatedAt: number;
}

export type SubmissionStatus = 'new' | 'in_progress' | 'resolved' | 'spam';

export interface SubmissionAnnotation {
  status: SubmissionStatus;
  note: string;
  updatedAt: number;
}

export interface CreatorAnnotations {
  formId: string;
  annotations: Record<string, SubmissionAnnotation>;
}
```

- [ ] Types tạo xong, không có TypeScript error

---

## ✅ Checkpoint Phase 0

- [ ] `npm run dev` trong `walform/` — app chạy tại localhost:3000
- [ ] Không có console error khi mở trang
- [ ] `sui move build` trong `walform-contracts/` pass
- [ ] Folder structure đúng theo plan

**Done → sang [PHASE_1_MOVE_CONTRACTS.md](./PHASE_1_MOVE_CONTRACTS.md)**
