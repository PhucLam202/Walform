# Phase 3 — Seal + Vercel API + E2E Tests

> **Mục tiêu:** seal.ts hoàn chỉnh, submission notification API, E2E 3 flow pass
> **Thời gian:** ~4h
> **Cần trước:** Phase 2 hoàn thành
> **Status:** 🟨 CODE READY — E2E wallet/network tests pending

---

## ⚠️ TRƯỚC KHI BẮT ĐẦU

- [ ] Mở https://seal-docs.wal.app → tìm **Mainnet Key Servers** → lấy objectId của ít nhất 2 servers
- [ ] Điền vào `.env.local`:
  ```
  NEXT_PUBLIC_SEAL_SERVER_1=0x<ruby_nodes_id>
  NEXT_PUBLIC_SEAL_SERVER_2=0x<nodeinfra_id>
  NEXT_PUBLIC_SEAL_PACKAGE_ID=0x<seal_mainnet_pkg>
  NEXT_PUBLIC_SUI_GRPC_URL=https://fullnode.testnet.sui.io:443
  ```
- [ ] Với testnet: check seal-docs.wal.app xem có testnet key servers không (thường cùng server)

## 2026-05-07 Implementation Update

- [x] Phase 2 Walrus upload endpoint changed from `/v1/store` to `/v1/blobs`.
- [x] `walform/src/lib/seal.ts` implemented against installed `@mysten/seal@1.1.1` exports:
  - `SealClient` with `serverConfigs: [{ objectId, weight }]`
  - `verifyKeyServers: true`
  - `SessionKey.create(...)`
  - gRPC Sui client for Seal key-server verification
- [x] `seal_approve` PTB now passes `id: vector<u8>` as the form object ID bytes plus `&AdminCap`.
- [x] Notification APIs implemented with an in-memory local store:
  - `walform/src/app/api/notify-submission/route.ts`
  - `walform/src/app/api/pending-submissions/route.ts`
- [x] `phases/KNOWN_ISSUES.md` created.
- [x] `pnpm exec tsc --noEmit` passes.
- [ ] Real wallet E2E create/submit/decrypt tests still need env values, funded wallet, and key server IDs.

> Note: the installed package docs mention `$extend(seal(...))`, but `@mysten/seal@1.1.1` does not publicly export `seal` from its package entrypoint. Current implementation uses the exported `SealClient` with the same `serverConfigs`/verification model, so it typechecks against the dependency in this repo.

---

## 3.1 Implement `src/lib/seal.ts`

```typescript
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  PACKAGE_ID,
  SEAL_PACKAGE_ID,
  SEAL_KEY_SERVERS,
  SEAL_THRESHOLD,
} from './constants';

// Singleton SealClient
let _sealClient: SealClient | null = null;
export function createSealClient(suiClient: SuiClient): SealClient {
  if (!_sealClient) {
    _sealClient = new SealClient({
      suiClient,
      serverConfigs: SEAL_KEY_SERVERS,
      verifyKeyServers: true,
    });
  }
  return _sealClient;
}

// Encrypt sensitive data cho một form
export async function encryptForForm(params: {
  sealClient: SealClient;
  formId: string;           // Sui object ID của Form
  data: string;             // JSON string của sensitive fields
}): Promise<{
  encryptedData: string;    // base64
  sealRef: string;          // base64
}> {
  const bytes = new TextEncoder().encode(params.data);

  const { encryptedObject } = await params.sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: params.formId,      // formId là policy namespace
    data: bytes,
  });

  return {
    encryptedData: Buffer.from(encryptedObject).toString('base64'),
    sealRef: '', // Seal metadata is inside encryptedObject; do not store the returned DEM key
  };
}

// Build PTB cho Seal dry_run (creator phải sign)
// Creator pass AdminCap → seal_approve verify quyền
export function buildSealApprovePTB(params: {
  formObjectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::policy::seal_approve`,
    arguments: [
      tx.pure.vector('u8', Array.from(fromHex(params.formObjectId))),
      tx.object(params.adminCapId),
    ],
  });
  return tx;
}

// Tạo session key để decrypt (creator sign 1 lần, dùng cho nhiều submissions)
export async function createCreatorSessionKey(params: {
  sealClient: SealClient;
  suiClient: SuiClient;
  signPersonalMessage: (msg: Uint8Array) => Promise<{ signature: string }>;
  formId: string;
  adminCapId: string;
}): Promise<SessionKey> {
  const sessionKey = await SessionKey.create({
    address: params.address,
    packageId: PACKAGE_ID,
    ttlMin: 30,
    suiClient: params.suiClient,
  });

  const messageBytes = sessionKey.getPersonalMessage();
  const { signature } = await params.signPersonalMessage(messageBytes);
  sessionKey.setPersonalMessageSignature(signature);

  // Build + serialize PTB để Seal verify
  const tx = buildSealApprovePTB({
    formObjectId: params.formId,
    adminCapId: params.adminCapId,
  });
  tx.setSender(''); // sender sẽ được set bởi wallet
  const txBytes = await tx.build({ client: params.suiClient });

  await params.sealClient.fetchKeys({
    ids: [params.formId],
    txBytes,
    sessionKey,
    threshold: SEAL_THRESHOLD,
  });

  return sessionKey;
}

// Decrypt một submission
export async function decryptSubmission(params: {
  sealClient: SealClient;
  sessionKey: SessionKey;
  suiClient: SuiClient;
  formId: string;
  adminCapId: string;
  encryptedData: string;    // base64
  sealRef: string;          // base64
}): Promise<string> {
  const encDataBytes = Buffer.from(params.encryptedData, 'base64');
  const tx = buildSealApprovePTB({
    formObjectId: params.formId,
    adminCapId: params.adminCapId,
  });
  const txBytes = await tx.build({ client: params.suiClient });

  const decrypted = await params.sealClient.decrypt({
    data: encDataBytes,
    sessionKey: params.sessionKey,
    txBytes,
  });

  return new TextDecoder().decode(decrypted);
}
```

> **⚠️ Note:** `SessionKey` API có thể khác tùy Seal SDK version. Xem `@mysten/seal` types.
> `buildSealApprovePTB` — xác nhận cách pass `id` parameter theo Seal examples.

- [ ] File tạo xong
- [ ] `npx tsc --noEmit` — không có error mới

---

## 3.2 Implement Vercel API Route (Notification)

**`src/app/api/notify-submission/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  addPendingSubmission,
  checkSubmissionNotifyRateLimit,
} from '@/lib/submission-notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formId, submissionBlobId } = body as {
      formId: string;
      submissionBlobId: string;
    };

    if (!formId || !submissionBlobId) {
      return NextResponse.json({ error: 'Missing formId or submissionBlobId' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkSubmissionNotifyRateLimit(formId, ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    addPendingSubmission(formId, submissionBlobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify-submission]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**`src/app/api/pending-submissions/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  clearPendingSubmissions,
  getPendingSubmissions,
} from '@/lib/submission-notifications';

export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  return NextResponse.json({ blobIds: getPendingSubmissions(formId) });
}

export async function DELETE(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  clearPendingSubmissions(formId);
  return NextResponse.json({ ok: true });
}
```

> **Production:** `src/lib/submission-notifications.ts` hiện là in-memory Map để unblock local E2E. Trước khi deploy production, thay implementation này bằng Vercel KV/Redis:
> ```typescript
> const pending = new Map<string, string[]>();
> // lpush → pending.get(key)?.push(val) hoặc pending.set(key, [val])
> // lrange → pending.get(key) ?? []
> ```

- [ ] API routes tạo xong

---

## 3.3 E2E Test 1 — Create Form

Chạy trong một Next.js page test hoặc `scripts/test-e2e.ts`:

```typescript
// 1. Upload mock FormConfig lên Walrus
const { blobId: configBlobId } = await uploadJSON({
  id: 'test-form-001',
  title: 'E2E Test Form',
  form_type: 'survey',
  version: 0,
  fields: [{ id: 'f1', type: 'text', label: 'Name', isSensitive: false, validation: { required: true }, order: 0 }],
  sensitiveFieldIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
console.log('Config blobId:', configBlobId);

// 2. Build TX
const tx = buildCreateFormTx({
  title: 'E2E Test Form',
  description: 'E2E test',
  formType: 'survey',
  configBlobId,
});

// 3. Sign + Execute (cần wallet connected)
const response = await wallet.signAndExecuteTransaction({ transaction: tx });

// 4. Extract form + cap IDs
const { formId, adminCapId } = extractFormAndCap(response);
console.log('Form ID:', formId);
console.log('AdminCap ID:', adminCapId);

// 5. Verify on-chain
const form = await getFormObject(formId);
console.log('Form config_blob_id:', form.config_blob_id); // phải = configBlobId
```

- [ ] configBlobId upload thành công
- [ ] TX execute thành công
- [ ] formId + adminCapId extracted
- [ ] form.config_blob_id === configBlobId
- [ ] Verify tại testnet.suivision.xyz

---

## 3.4 E2E Test 2 — Submit Response

```typescript
// Giả sử: formId từ test trên, formVersion = 0

const sensitiveData = JSON.stringify({ email: 'test@walform.xyz' });

// 1. Encrypt với Seal
const { encryptedData, sealRef } = await encryptForForm({
  sealClient,
  formId,
  data: sensitiveData,
});

// 2. Bundle submission blob
const submissionBlob = {
  formId,
  formVersion: 0,
  submittedAt: Date.now(),
  plainFields: { name: 'E2E Tester' },
  encryptedFields: encryptedData,
  sealRef,
};

// 3. Upload lên Walrus
const submissionBlobId = await uploadSubmissionBlob(submissionBlob);
console.log('Submission blobId:', submissionBlobId);

// 4. Notify API
await fetch('/api/notify-submission', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ formId, submissionBlobId }),
});

// 5. Fetch pending
const { blobIds } = await fetch(`/api/pending-submissions?formId=${formId}`).then(r => r.json());
console.log('Pending:', blobIds); // phải có submissionBlobId

// 6. Merge vào index
const currentForm = await getFormObject(formId);
const newIndexBlobId = await appendToSubmissionIndex({
  currentIndexBlobId: currentForm.submissions_index_blob_id,
  newSubmissionBlobId: submissionBlobId,
  formId,
});
console.log('New index blobId:', newIndexBlobId);

// 7. Update on-chain
const updateTx = buildUpdateSubmissionsIndexTx({
  formObjectId: formId,
  adminCapId,
  indexBlobId: newIndexBlobId,
});
await wallet.signAndExecuteTransaction({ transaction: updateTx });

// 8. Verify
const updatedForm = await getFormObject(formId);
console.log('submissions_index_blob_id:', updatedForm.submissions_index_blob_id);
// phải = newIndexBlobId
```

- [ ] Encrypt thành công
- [ ] Submission blob upload thành công
- [ ] Notify API trả 200
- [ ] Index blob updated on-chain
- [ ] `submissions_index_blob_id` khớp

---

## 3.5 E2E Test 3 — Decrypt Submission

```typescript
// 1. Fetch index
const form = await getFormObject(formId);
const index = await fetchSubmissionIndex(form.submissions_index_blob_id!);
console.log('Index has', index.blobIds.length, 'submissions');

// 2. Fetch submission blob
const sub = await downloadJSON<SubmissionBlob>(index.blobIds[0]);

// 3. Tạo session key (cần wallet sign)
const sessionKey = await createCreatorSessionKey({
  sealClient,
  suiClient: getSuiClient(),
  signPersonalMessage: wallet.signPersonalMessage,
  formId,
  adminCapId,
});

// 4. Decrypt
const plainText = await decryptSubmission({
  sealClient,
  sessionKey,
  suiClient: getSuiClient(),
  formId,
  adminCapId,
  encryptedData: sub.encryptedFields!,
  sealRef: sub.sealRef!,
});

console.log('Decrypted:', JSON.parse(plainText));
// phải = { email: 'test@walform.xyz' }
```

- [ ] Index fetch thành công
- [ ] Session key tạo thành công (wallet sign)
- [ ] Decrypt trả `{ email: 'test@walform.xyz' }`

---

## 3.6 Test Non-Owner Decrypt (Negative)

```typescript
// Dùng wallet khác (không phải creator)
// Session key tạo với non-creator wallet
// Seal key servers sẽ từ chối vì seal_approve return false

// Expected: decryptSubmission throw error
// Log error message để verify
```

- [ ] Non-creator decrypt bị reject bởi Seal key servers

---

## 3.7 Document Known Issues

Tạo `phases/KNOWN_ISSUES.md`:

```markdown
# Known Issues

## [DATE]

### KI-001: extractFormAndCap thứ tự objects
- **Issue:** Form vs AdminCap thứ tự trong effects.created chưa xác nhận
- **Status:** Cần verify sau test thực tế
- **Fix:** Dùng objectType để distinguish thay vì index

### KI-002: Seal SDK export mismatch
- **Issue:** Installed `@mysten/seal@1.1.1` docs mention `$extend(seal(...))`, but package entrypoint does not export `seal`.
- **Status:** Implemented with exported `SealClient` + `serverConfigs` + `SessionKey.create`.
- **Fix:** Revisit after upgrading `@mysten/seal`.

### KI-003: Local dev không có Vercel KV
- **Issue:** Current local implementation uses in-memory Map instead of durable Vercel KV.
- **Fix:** Replace `src/lib/submission-notifications.ts` with Vercel KV/Redis before production.
```

- [x] KNOWN_ISSUES.md tạo xong

---

## ✅ Checkpoint Phase 3

- [x] `seal.ts`: implemented and typechecks
- [x] Vercel API routes: notify + pending fetch implemented locally
- [ ] E2E Test 1 (Create Form): Form trên testnet explorer
- [ ] E2E Test 2 (Submit): Submission blob + index update on-chain
- [ ] E2E Test 3 (Decrypt): Plain text đúng
- [ ] Non-owner decrypt bị reject
- [x] KNOWN_ISSUES.md ghi lại issues

**Done → sang [PHASE_4_FRONTEND.md](./PHASE_4_FRONTEND.md)**
