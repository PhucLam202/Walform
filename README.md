# WalForm — Decentralized Encrypted Forms on Sui

> **Hackathon submission** · Built on Walrus · Sui · Seal

**WalForm** lets anyone build a form, share a link, and collect responses — with sensitive fields encrypted client-side before a single byte leaves the browser. No centralized database. No server holding your data. Every config and response lives permanently on [Walrus](https://walrus.site) decentralized storage, with access control enforced on-chain via [Sui](https://sui.io) smart contracts and threshold encryption by [Seal](https://github.com/MystenLabs/seal).

---

## Screenshots

### Landing Page
![WalForm landing — Build forms. Collect responses. Store forever.](walform/public/z7807112050754_410024b30ca4e4ed2d06bb8d37b5c418.jpg)

### Creator Dashboard
![Creator dashboard — manage forms, view submission stats, create new forms](walform/public/z7807112344194_966de90f3d7aa631bc859dc507b3a632.jpg)

### Visual Form Builder
![Drag-and-drop builder — add fields, mark sensitive, publish on-chain in one click](walform/public/z7807112679049_23e4b770e2704d754f87145bbed68760.jpg)

---

## The Problem

Traditional form tools (Google Forms, Typeform, Airtable) store every response in a centralized server. Operators can read your data, leak it, or sell it. Respondents have no verifiable guarantee of privacy.

Web3 native data collection had no good answer — putting responses on-chain is expensive, slow, and public by default.

---

## What WalForm Does

| Feature | How |
|---|---|
| **Drag-and-drop form builder** | Visual editor with 13 field types, drag-to-reorder, per-field settings |
| **Sensitive field encryption** | AES-GCM + Seal threshold encryption — encrypted in-browser before upload |
| **Wallet-free respondents** | Submitters don't need a Sui wallet or gas. They just fill and submit. |
| **Permanent storage** | Form configs + all responses stored on Walrus (decentralized blob storage) |
| **On-chain access control** | `Form` object on Sui holds `AdminCap`. Only the form owner can decrypt responses. |
| **Zero-server architecture** | No backend API, no database. Next.js static frontend + Walrus + Sui. |

---

## Architecture

```
Create Form
  Builder state → JSON → Walrus PUT → blobId
  → form::create_form(blobId) PTB → wallet sign → Form object on-chain

Submit Response (wallet-free)
  Fetch config blob → render fields
  → AES-GCM encrypt sensitive fields
  → Seal threshold encrypt (key = formId policy)
  → Upload encrypted JSON to Walrus
  → POST /api/notify-submission (index update)

Decrypt Submission (form owner only)
  Fetch submission blob → extract sealRef
  → seal.createSessionKey(wallet, formId)
  → seal.decrypt(sessionKey, sealRef)
  → AES decrypt → render in modal
```

**Key design choice:** Submissions are Walrus-only — not on-chain objects. This makes submitting free (no gas) and anonymous.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Blockchain | Sui (Move smart contracts) |
| Storage | Walrus decentralized blob storage |
| Encryption | Mysten Seal (threshold encryption) + AES-GCM |
| State | Zustand 5, TanStack Query 5 |
| UI | shadcn/ui, dnd-kit, react-hook-form + Zod |

---

## Smart Contracts

```
walform_contracts/
├── form.move    — Form object + AdminCap (transferable ownership)
└── policy.move  — seal_approve entry function (access control by formId)
```

**Deployed on Sui Testnet**

- Package: `0x29d0a871d174e873e41681cc497b77e5705715cb07deb06808d3c1779d90b8cc`
- Explorer: [suivision.xyz](https://testnet.suivision.xyz/package/0x29d0a871d174e873e41681cc497b77e5705715cb07deb06808d3c1779d90b8cc)

---

## Running Locally

```bash
# 1. Install dependencies
cd walform
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in values from DEPLOYMENT_INFO.txt

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

**Required env variables:**

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x29d0a871d174e873e41681cc497b77e5705715cb07deb06808d3c1779d90b8cc
NEXT_PUBLIC_SEAL_SERVER_1=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_THRESHOLD=1
```

---

## App Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Creator dashboard (wallet-gated) |
| `/builder` | New form builder |
| `/builder/[formId]` | Edit existing form |
| `/forms/[formId]` | Submissions viewer for a form |
| `/f/[formId]` | **Public share link** — what respondents see |

---

## Repository Structure

```
WalrusSS2/
├── walform/              # Next.js 16 frontend
│   ├── src/app/          # App Router pages
│   ├── src/components/   # UI components
│   ├── src/lib/          # Walrus, Seal, Sui helpers
│   └── src/store/        # Zustand builder state
├── walform_contracts/    # Sui Move packages
│   ├── form.move
│   └── policy.move
├── files/                # Architecture & SRS docs
└── DEPLOYMENT_INFO.txt   # Deployed addresses & infra
```

---

## License

MIT

---

<p align="center">
  Built with ❤️ for the Sui / Walrus Hackathon<br/>
  <strong>WalForm</strong> — Build forms. Collect responses. Store forever.<br/>
  Your data, encrypted end-to-end, on-chain.
</p>
