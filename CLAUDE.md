# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

```
WalrusSS2/
├── walform/              # Next.js 16 frontend app
├── walform_contracts/    # Sui Move smart contracts
├── files/                # Architecture & SRS docs
├── phases/               # Build phase plans
└── DEPLOYMENT_INFO.txt   # Deployed contract addresses & infra
```

## Frontend (walform/)

### Commands
```bash
cd walform
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

### IMPORTANT: Next.js version
This uses **Next.js 16** — not the version in Claude's training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. APIs and conventions may differ from prior versions.

### Tech Stack
- Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- `@mysten/sui` ^2.x, `@mysten/dapp-kit` ^1.x, `@mysten/seal` ^1.x, `@mysten/walrus` ^1.x
- Zustand 5 (builder state), TanStack Query 5, react-hook-form 7, Zod 4
- dnd-kit (drag-drop in builder), shadcn/ui components

### Key Source Files
- `src/lib/constants.ts` — all env-driven config (package IDs, Walrus URLs, Seal servers)
- `src/lib/walrus.ts` — Walrus HTTP API upload/download helpers
- `src/lib/seal.ts` — Seal encrypt/decrypt helpers
- `src/lib/contracts.ts` — Move PTB call builders
- `src/lib/sui-client.ts` — SuiClient singleton
- `src/store/builder.ts` — Zustand store for form builder state
- `src/hooks/useForms.ts` — query owned Form objects from Sui
- `src/hooks/useSubmissions.ts` — query submissions (from Walrus index)
- `src/hooks/useDecrypt.ts` — Seal session key + decrypt flow

### App Routes
- `/` — landing page
- `/dashboard` — creator dashboard (wallet-gated)
- `/builder` — new form builder; `/builder/[formId]` — edit form
- `/forms/[formId]` — submissions dashboard for a form
- `/f/[formId]` — public form fill page (no wallet needed)

### Environment Variables
Copy `.env.example` to `.env.local`. For testnet development use values from `DEPLOYMENT_INFO.txt`:
```
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x29d0a871d174e873e41681cc497b77e5705715cb07deb06808d3c1779d90b8cc
NEXT_PUBLIC_SEAL_SERVER_1=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_THRESHOLD=1
```

## Smart Contracts (walform_contracts/)

### Commands
```bash
# From walform_contracts/
sui move build
sui move test
sui client publish --gas-budget 100000000   # Deploy
```

### Modules
- `form.move` — `Form` (owned object) + `AdminCap` (transferable permission). Form stores `config_blob_id` pointing to a Walrus blob with field definitions JSON.
- `policy.move` — `seal_approve` entry function for Seal SDK access control. The policy namespace is `form_id`; only holders of matching `AdminCap` can decrypt.

### Deployed (Testnet)
- Package: `0x29d0a871d174e873e41681cc497b77e5705715cb07deb06808d3c1779d90b8cc`
- See `DEPLOYMENT_INFO.txt` for full deployment details.

## Architecture — Data Flows

**Create Form:** Builder state → serialize JSON → Walrus upload (HTTP PUT) → get `blobId` → `form::create_form(blobId)` PTB → wallet sign → navigate to `/forms/[id]`

**Submit Form:** Fetch config blob from Walrus → render fields → AES-GCM encrypt sensitive fields → `seal.encrypt(key, policyId=formId)` → upload encrypted JSON blob to Walrus → store blob reference (no on-chain TX for submitter — wallet-free)

**Decrypt Submission:** Fetch submission blob → extract `sealRef` → `seal.createSessionKey(wallet, formId)` → `seal.decrypt(sessionKey, sealRef)` → AES decrypt → render in modal

**Key design decision:** Submissions are Walrus-only (not on-chain objects). The `Form` object on Sui stores a Walrus-based submission index. This avoids requiring responders to have a wallet or pay gas.

## Walrus HTTP API
Walrus is accessed via HTTP (not the SDK) for simplicity:
- Upload: `PUT https://publisher.../v1/store` with blob body → returns `newlyCreated.blobObject.blobId` or `alreadyCertified.blobId`
- Download: `GET https://aggregator.../v1/{blobId}`
- Multiple publishers/aggregators are configured with fallback in `constants.ts`

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
