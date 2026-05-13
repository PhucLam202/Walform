# Known Issues

## 2026-05-07

### KI-001: extractFormAndCap fallback order
- **Issue:** `objectChanges` with `showObjectChanges: true` is the reliable source for Form/AdminCap IDs. The fallback still uses `effects.created` order.
- **Status:** Code prefers `objectType`; fallback remains for older responses.
- **Fix:** Always request `showObjectChanges: true` when executing `create_form`.

### KI-002: Seal SDK export mismatch
- **Issue:** Installed `@mysten/seal@1.1.1` docs mention `$extend(seal(...))`, but the package public entrypoint currently does not export `seal`.
- **Status:** `seal.ts` uses the exported `SealClient` with new `serverConfigs` and `SessionKey.create`.
- **Fix:** Revisit after upgrading `@mysten/seal`; switch to `$extend(seal(...))` only when the public export exists.

### KI-003: Local notification store is in-memory
- **Issue:** The notification API currently uses a process-local Map so Phase 3 works without `@vercel/kv`.
- **Status:** Fine for local E2E; not durable across server restarts or serverless instances.
- **Fix:** Replace `src/lib/submission-notifications.ts` with Vercel KV/Redis before production deploy.

### KI-004: Seal key server IDs required
- **Issue:** Encryption/decryption will fail until `NEXT_PUBLIC_SEAL_SERVER_1`, `NEXT_PUBLIC_SEAL_SERVER_2`, and `NEXT_PUBLIC_PACKAGE_ID` are set.
- **Status:** Guarded at runtime.
- **Fix:** Fill env values from verified Seal key servers for the target network.
