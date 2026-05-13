# Architecture — WalForm
> Solo Build · Optimized for Speed · Mainnet Ready

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)                  │
│                                                           │
│  /dashboard    /builder    /f/[formId]    /forms/[id]    │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │  Sui SDK  │  │  Walrus  │  │  Seal SDK    │
    │ (objects) │  │  (blobs) │  │ (encryption) │
    └──────────┘  └──────────┘  └──────────────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
              ┌─────────────────────┐
              │   Sui Mainnet       │
              │  + Walrus Mainnet   │
              └─────────────────────┘
```

---

## 2. Smart Contract Architecture (Move)

### Package Structure
```
move/
└── walform/
    ├── Move.toml
    └── sources/
        ├── form.move        # Form object + config
        ├── submission.move  # Submission object + blob ref
        └── policy.move      # Seal access control
```

### 2.1 `form.move`

```move
module walform::form {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use std::string::String;

    /// Owned object — creator holds this
    public struct Form has key, store {
        id: UID,
        title: String,
        description: String,
        config_blob_id: vector<u8>,   // Walrus blob: form field definitions JSON
        is_active: bool,
        submission_count: u64,
        created_at: u64,
    }

    /// AdminCap — transferable permission
    public struct AdminCap has key, store {
        id: UID,
        form_id: ID,
    }

    public fun create_form(
        title: String,
        description: String,
        config_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (Form, AdminCap) { ... }

    public fun toggle_active(form: &mut Form, _cap: &AdminCap) { ... }

    public fun increment_submission(form: &mut Form) { ... }
}
```

### 2.2 `submission.move`

```move
module walform::submission {
    use sui::object::{Self, UID};

    /// Shared object — readable by anyone with reference,
    /// but encrypted data only decryptable by authorized
    public struct Submission has key {
        id: UID,
        form_id: ID,
        blob_id: vector<u8>,           // Walrus blob: encrypted submission JSON
        seal_key_ref: vector<u8>,      // Seal encrypted symmetric key
        status: u8,                     // 0=new 1=in_progress 2=resolved 3=spam
        note: Option<String>,           // Private note (set by creator only)
        created_at: u64,
    }

    public fun create_submission(
        form_id: ID,
        blob_id: vector<u8>,
        seal_key_ref: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) { ... }

    public fun update_status(
        sub: &mut Submission,
        status: u8,
        _cap: &AdminCap,
    ) { ... }

    public fun add_note(
        sub: &mut Submission,
        note: String,
        _cap: &AdminCap,
    ) { ... }
}
```

### 2.3 `policy.move` (Seal integration)

```move
module walform::policy {
    /// Seal calls this to decide if decrypt is allowed
    /// id = form_id (policy namespace)
    public fun seal_approve(
        id: vector<u8>,
        cap: &AdminCap,
    ): bool {
        // cap.form_id == ID from id bytes
        object::id_bytes(&cap.form_id) == id
    }
}
```

> **Note cho solo builder:** Seal `seal_approve` function signature phải match chính xác theo Seal docs. Đọc kỹ `examples/move` trong Seal repo trước khi implement.

---

## 3. Frontend Architecture (Next.js 15)

### 3.1 Folder Structure
```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── dashboard/
│   │   └── page.tsx               # Creator dashboard (protected)
│   ├── builder/
│   │   ├── page.tsx               # Form builder
│   │   └── [formId]/page.tsx      # Edit existing form
│   ├── forms/
│   │   └── [formId]/
│   │       └── page.tsx           # Dashboard detail: submissions list
│   └── f/
│       └── [formId]/
│           └── page.tsx           # Public form fill page
├── components/
│   ├── builder/
│   │   ├── FieldPalette.tsx       # Draggable field types
│   │   ├── FieldEditor.tsx        # Configure single field
│   │   ├── FormCanvas.tsx         # Drop zone, ordered list
│   │   └── FormPreview.tsx        # Live preview
│   ├── dashboard/
│   │   ├── FormCard.tsx
│   │   ├── SubmissionTable.tsx
│   │   ├── SubmissionDetail.tsx   # Decrypt & View
│   │   └── ExportButton.tsx
│   ├── form/
│   │   ├── FieldRenderer.tsx      # Render any field type
│   │   └── FileUploader.tsx       # Upload to Walrus with progress
│   └── ui/                        # shadcn components
├── lib/
│   ├── sui-client.ts              # SuiClient singleton
│   ├── walrus.ts                  # Upload/download helpers
│   ├── seal.ts                    # Encrypt/decrypt helpers
│   ├── contracts.ts               # Move call builders
│   └── constants.ts               # Package IDs, configs
├── hooks/
│   ├── useForms.ts                # Query owned forms
│   ├── useSubmissions.ts          # Query submissions for a form
│   └── useDecrypt.ts              # Seal decrypt flow
├── store/
│   └── builder.ts                 # Zustand: form builder state
└── types/
    ├── form.ts
    └── submission.ts
```

### 3.2 Data Flow — Create Form

```
User fills builder
     │
     ▼
BuilderState (Zustand)
     │
     ▼
[Publish click]
     │
     ├─→ 1. Serialize form config → JSON
     ├─→ 2. walrus.uploadJSON(config) → blobId
     ├─→ 3. contracts.createForm(blobId) → PTB
     ├─→ 4. wallet.signAndExecuteTransaction()
     └─→ 5. Navigate to /forms/[formId] (share link)
```

### 3.3 Data Flow — Submit Form

```
Responder fills /f/[formId]
     │
     ▼
1. Fetch form config blob from Walrus → render fields
     │
     ▼
2. User fills data
     │
     ▼
3. Identify sensitive fields
     │
     ├─→ 3a. Generate AES-GCM key
     ├─→ 3b. Encrypt sensitive JSON
     └─→ 3c. seal.encrypt(key, policyId=formId) → sealRef
     │
     ▼
4. walrus.uploadJSON({ plainFields, encryptedFields, sealRef }) → blobId
     │
     ▼
5. contracts.createSubmission(formId, blobId, sealRef)
     │
     ▼
6. Success screen (no wallet needed — sponsored TX or just Walrus upload)
```

> **Simplification:** Responder không cần wallet. Submission là shared object được tạo bởi một "relayer" hoặc đơn giản hơn — lưu submission dưới dạng Walrus blob + index trong form object. **Quyết định: v1 dùng Walrus-only cho submissions, Sui object chỉ cho Form.**

### 3.4 Data Flow — Decrypt Submission

```
Creator ở dashboard, click "Decrypt & View"
     │
     ▼
1. Fetch submission blob từ Walrus → JSON
     │
     ▼
2. Extract sealRef + encryptedData
     │
     ▼
3. seal.createSessionKey(wallet, formId)
     │
     ▼
4. seal.decrypt(sessionKey, sealRef) → AES key
     │
     ▼
5. AES.decrypt(encryptedData, key) → plaintext
     │
     ▼
6. Render trong SubmissionDetail modal
```

---

## 4. Key Libraries & Versions

```json
{
  "@mysten/sui": "^1.x",
  "@mysten/walrus": "latest",
  "@mysten/seal": "latest",
  "@mysten/dapp-kit": "^0.x",
  "next": "15.x",
  "react": "19.x",
  "typescript": "^5.x",
  "tailwindcss": "^3.x",
  "@tanstack/react-query": "^5.x",
  "zustand": "^5.x",
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "lucide-react": "latest",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^7.x"
}
```

---

## 5. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_PACKAGE_ID=0x...          # sau khi publish Move
NEXT_PUBLIC_WALRUS_NETWORK=mainnet
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x...     # Seal mainnet package

# Không cần backend secret — fully client-side
```

---

## 6. Walrus Upload Strategy

```typescript
// lib/walrus.ts
export async function uploadJSON(data: object): Promise<string> {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  // Dùng Walrus HTTP API (đơn giản hơn SDK cho hackathon)
  const res = await fetch('https://publisher.walrus-mainnet.walrus.space/v1/store', {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await res.json();
  return result.newlyCreated?.blobObject?.blobId 
      ?? result.alreadyCertified?.blobId;
}

export async function downloadJSON<T>(blobId: string): Promise<T> {
  const res = await fetch(
    `https://aggregator.walrus-mainnet.walrus.space/v1/${blobId}`
  );
  return res.json();
}
```

> **Tip:** Dùng HTTP API của Walrus thay vì SDK cho hackathon — đơn giản hơn nhiều, ít config hơn.

---

## 7. Simplification Decisions (cho solo + 12 ngày)

| Decision | Lý do |
|----------|--------|
| Submissions lưu Walrus-only, Form object trên Sui | Tránh phức tạp gasless TX cho responder |
| Walrus HTTP API thay vì SDK | Ít setup hơn, đủ dùng |
| Seal threshold = 2 verified key servers | Min viable encryption |
| Không implement AdminCap grant (v1) | Tiết kiệm 1-2 ngày, owner-only là đủ |
| shadcn/ui components có sẵn | Không tốn thời gian design từ đầu |
| dnd-kit cho drag-drop builder | Nhẹ hơn react-beautiful-dnd |
