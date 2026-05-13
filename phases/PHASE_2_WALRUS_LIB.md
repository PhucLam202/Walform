# Phase 2 — Walrus + Contracts lib/

> **Mục tiêu:** `walrus.ts` + `contracts.ts` + `sui-client.ts` hoàn chỉnh, test upload/download OK
> **Thời gian:** ~3h
> **Cần trước:** Phase 1 hoàn thành, packageId trong `.env.local`
> **Status:** ⬜ TODO

---

## 2.1 Implement `src/lib/walrus.ts`

```typescript
import { WALRUS_PUBLISHERS, WALRUS_AGGREGATORS, WALRUS_EPOCHS } from './constants';
import type { SubmissionBlob, SubmissionIndex } from '@/types/submission';

export interface WalrusUploadResult {
  blobId: string;
  isNew: boolean;
}

function getRandomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomPublisher(): string { return getRandomFrom(WALRUS_PUBLISHERS); }
export function getRandomAggregator(): string { return getRandomFrom(WALRUS_AGGREGATORS); }

// --- Retry helper ---
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw new Error('unreachable');
}

// --- Parse Walrus response ---
function parseBlobId(result: unknown): string {
  const r = result as any;
  const blobId = r?.newlyCreated?.blobObject?.blobId ?? r?.alreadyCertified?.blobId;
  if (!blobId) throw new Error('Walrus: no blobId returned');
  return blobId;
}

// --- Core upload ---
export async function uploadBlob(
  data: string | Blob,
  mimeType = 'application/octet-stream',
  retries = 3,
): Promise<WalrusUploadResult> {
  return withRetry(async () => {
    const body = typeof data === 'string'
      ? new Blob([data], { type: mimeType })
      : data;
    const res = await fetch(
      `${getRandomPublisher()}/v1/blobs?epochs=${WALRUS_EPOCHS}`,
      { method: 'PUT', body },
    );
    if (!res.ok) throw new Error(`Walrus upload HTTP ${res.status}`);
    const json = await res.json();
    const blobId = parseBlobId(json);
    return { blobId, isNew: !!(json as any).newlyCreated };
  }, retries);
}

// --- Large file upload with progress ---
export function uploadLargeFile(
  file: File,
  onProgress?: (pct: number) => void,
  retries = 3,
): Promise<WalrusUploadResult> {
  const attempt = () => new Promise<WalrusUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        const blobId = parseBlobId(json);
        resolve({ blobId, isNew: !!json.newlyCreated });
      } catch (e) { reject(e); }
    };
    xhr.onerror = () => reject(new Error('Walrus large file upload failed'));
    xhr.open('PUT', `${getRandomPublisher()}/v1/blobs?epochs=${WALRUS_EPOCHS}`);
    xhr.send(file);
  });
  return withRetry(attempt, retries);
}

// --- Download ---
export async function downloadBlob<T>(blobId: string): Promise<T> {
  const res = await fetch(`${getRandomAggregator()}/v1/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download HTTP ${res.status} for blobId=${blobId}`);
  return res.json();
}

// --- JSON shortcuts ---
export async function uploadJSON<T>(data: T): Promise<WalrusUploadResult> {
  return uploadBlob(JSON.stringify(data), 'application/json');
}

export async function downloadJSON<T>(blobId: string): Promise<T> {
  return downloadBlob<T>(blobId);
}

// --- Submission-specific ---
export async function uploadSubmissionBlob(blob: SubmissionBlob): Promise<string> {
  const { blobId } = await uploadJSON(blob);
  return blobId;
}

export async function fetchSubmissionIndex(indexBlobId: string): Promise<SubmissionIndex> {
  return downloadJSON<SubmissionIndex>(indexBlobId);
}

// Download và append blobId mới, upload index mới, trả indexBlobId mới
export async function appendToSubmissionIndex(params: {
  currentIndexBlobId: string | null;
  newSubmissionBlobId: string;
  formId: string;
}): Promise<string> {
  let index: SubmissionIndex;

  if (params.currentIndexBlobId) {
    index = await fetchSubmissionIndex(params.currentIndexBlobId);
    index.blobIds.push(params.newSubmissionBlobId);
    index.version += 1;
    index.updatedAt = Date.now();
  } else {
    index = {
      formId: params.formId,
      version: 1,
      blobIds: [params.newSubmissionBlobId],
      updatedAt: Date.now(),
    };
  }

  const { blobId } = await uploadJSON(index);
  return blobId;
}
```

- [ ] File tạo xong

**Quick test (browser console hoặc script):**
```typescript
import { uploadJSON, downloadJSON } from '@/lib/walrus';

const { blobId } = await uploadJSON({ hello: 'WalForm', ts: Date.now() });
console.log('blobId:', blobId);

const data = await downloadJSON(blobId);
console.log('data:', data);
// Phải match với object đã upload
```

- [ ] Upload thành công, blobId hợp lệ
- [ ] Download trả đúng dữ liệu

---

## 2.2 Implement `src/lib/contracts.ts`

```typescript
import { Transaction } from '@mysten/sui/transactions';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { PACKAGE_ID, FORM_TYPE_NAME, ADMIN_CAP_TYPE_NAME } from './constants';

// ===== TX Builders =====

export function buildCreateFormTx(params: {
  title: string;
  description: string;
  formType: string;
  configBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::create_form`,
    arguments: [
      tx.pure.string(params.title),
      tx.pure.string(params.description),
      tx.pure.string(params.formType),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(params.configBlobId))),
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}

export function buildToggleActiveTx(params: {
  formObjectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::toggle_active`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
    ],
  });
  return tx;
}

export function buildUpdateConfigTx(params: {
  formObjectId: string;
  adminCapId: string;
  newBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::update_config_blob`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(params.newBlobId))),
    ],
  });
  return tx;
}

export function buildUpdateSubmissionsIndexTx(params: {
  formObjectId: string;
  adminCapId: string;
  indexBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::update_submissions_index`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(params.indexBlobId))),
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}

export function buildGrantAdminTx(params: {
  formObjectId: string;
  adminCapId: string;
  adminAddress: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::grant_admin`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.address(params.adminAddress),
    ],
  });
  return tx;
}

// ===== Result Parsers =====

export function extractFormAndCap(response: SuiTransactionBlockResponse): {
  formId: string;
  adminCapId: string;
} {
  const created = response.effects?.created ?? [];

  const formObj = created.find(obj =>
    typeof obj.reference?.objectId === 'string' &&
    // Form object: owner là AddressOwner (không phải Shared)
    'AddressOwner' in (obj.owner ?? {})
  );

  // AdminCap + Form đều là AddressOwner, cần distinguish by type nếu có objectType
  // Fallback: lấy theo index (Form trước, AdminCap sau, hoặc ngược lại tuỳ Move version)
  // TODO: verify thứ tự sau khi test thực tế

  if (created.length < 2) {
    throw new Error('Expected 2 created objects (Form + AdminCap), got ' + created.length);
  }

  // Prefer checking objectType nếu có trong response
  const formId = created[0].reference.objectId;
  const adminCapId = created[1].reference.objectId;

  return { formId, adminCapId };
}
```

> **⚠️ Note:** `extractFormAndCap` cần verify thứ tự Form vs AdminCap trong `effects.created` sau khi test thực tế. Có thể cần request với `options: { showObjectChanges: true }` để lấy `objectType`.

- [ ] File tạo xong

---

## 2.3 Implement `src/lib/sui-client.ts`

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_NETWORK, FORM_TYPE_NAME, ADMIN_CAP_TYPE_NAME } from './constants';
import type { FormOnChain } from '@/types/form';

// Singleton
let _client: SuiClient | null = null;
export function getSuiClient(): SuiClient {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
  return _client;
}

// Parse raw Sui object → FormOnChain
function parseFormObject(raw: any): FormOnChain {
  const fields = raw?.data?.content?.fields;
  if (!fields) throw new Error('Invalid Form object structure');

  const indexBlob = fields.submissions_index_blob_id?.fields?.vec?.[0];
  const configBytes: number[] = fields.config_blob_id ?? [];

  return {
    id: raw.data.objectId,
    owner: fields.owner,
    title: fields.title,
    description: fields.description,
    form_type: fields.form_type,
    version: Number(fields.version),
    config_blob_id: new TextDecoder().decode(new Uint8Array(configBytes)),
    submissions_index_blob_id: indexBlob
      ? new TextDecoder().decode(new Uint8Array(indexBlob))
      : null,
    last_index_updated: Number(fields.last_index_updated ?? 0),
    is_active: fields.is_active,
    submission_count: Number(fields.submission_count ?? 0),
    created_at: Number(fields.created_at),
  };
}

export async function getFormObject(formId: string): Promise<FormOnChain> {
  const client = getSuiClient();
  const raw = await client.getObject({
    id: formId,
    options: { showContent: true, showOwner: true },
  });
  return parseFormObject(raw);
}

export async function getOwnedForms(address: string): Promise<FormOnChain[]> {
  const client = getSuiClient();
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: FORM_TYPE_NAME },
    options: { showContent: true, showOwner: true },
  });
  return data.map(parseFormObject).filter(Boolean);
}

export async function getAdminCap(
  address: string,
  formId: string,
): Promise<string | null> {
  const client = getSuiClient();
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: ADMIN_CAP_TYPE_NAME },
    options: { showContent: true },
  });

  for (const obj of data) {
    const fields = (obj.data?.content as any)?.fields;
    if (fields?.form_id === formId) {
      return obj.data?.objectId ?? null;
    }
  }
  return null;
}
```

- [ ] File tạo xong

---

## 2.4 TypeScript Check

```bash
cd walform
npx tsc --noEmit
```

- [ ] Zero TypeScript errors trong `lib/walrus.ts`, `lib/contracts.ts`, `lib/sui-client.ts`

---

## 2.5 Test contracts.ts với testnet (manual)

Trong Next.js page tạm hoặc browser console, connect wallet rồi chạy:

```typescript
// Test buildCreateFormTx structure
import { buildCreateFormTx } from '@/lib/contracts';

const tx = buildCreateFormTx({
  title: 'Test',
  description: 'Desc',
  formType: 'survey',
  configBlobId: 'testBlobId123',
});
console.log('TX targets:', tx.getData()); // Verify target module::function
```

- [ ] TX structure đúng (target = `{PACKAGE_ID}::form::create_form`)

---

## ✅ Checkpoint Phase 2

- [ ] `walrus.ts`: upload JSON → blobId valid, download → data khớp
- [ ] `walrus.ts`: `appendToSubmissionIndex` tạo index mới đúng structure
- [ ] `contracts.ts`: tất cả TX builders không throw
- [ ] `sui-client.ts`: `getOwnedForms` trả array (dù rỗng nếu chưa có forms)
- [ ] `npx tsc --noEmit` — zero errors

**Done → sang [PHASE_3_SEAL_E2E.md](./PHASE_3_SEAL_E2E.md)**
