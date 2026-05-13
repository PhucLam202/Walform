# WalForm — Phase Tracker

> Mỗi file phase = 1 phiên làm việc (2–4h). Đọc đúng file, làm xong tick, sang file tiếp.
> Full plan: `../SmartContract_BE_Build_And_Test_Plan.md`

---

## Trạng thái các Phase

| Phase | File | Nội dung | Thời gian | Status |
|-------|------|----------|-----------|--------|
| 0 | [PHASE_0_SETUP.md](./PHASE_0_SETUP.md) | Next.js app + deps + Move package + .env | ~1h | ✅ DONE |
| 1 | [PHASE_1_MOVE_CONTRACTS.md](./PHASE_1_MOVE_CONTRACTS.md) | form.move + policy.move + tests + deploy testnet | ~4h | 🔄 IN PROGRESS — build ✅ test 14/14 ✅ deploy ⬜ |
| 2 | [PHASE_2_WALRUS_LIB.md](./PHASE_2_WALRUS_LIB.md) | walrus.ts + contracts.ts + sui-client.ts | ~3h | ✅ DONE |
| 3 | [PHASE_3_SEAL_E2E.md](./PHASE_3_SEAL_E2E.md) | seal.ts + Vercel API route + E2E tests | ~4h | ⬜ TODO |
| 4 | [PHASE_4_FRONTEND.md](./PHASE_4_FRONTEND.md) | Builder + Form fill + Dashboard UI | ~1 ngày | ⬜ TODO |

---

## Files bổ sung (tạo trong quá trình build)

| File | Tạo ở phase | Mục đích |
|------|------------|----------|
| `KNOWN_IDS.md` | Phase 1 | Lưu packageId, object types |
| `KNOWN_ISSUES.md` | Phase 3 | Bug và workaround ghi lại |

---

## Cách dùng

1. Mở file phase hiện tại
2. Làm từ trên xuống, tick `[x]` khi xong
3. Khi phase xong: đổi status → `✅ DONE`
4. Sang phase tiếp theo

## Quy tắc context

- **Mỗi phiên Claude mới**: chỉ đọc README này + file phase hiện tại
- Không cần đọc lại SmartContract_BE_Build_And_Test_Plan.md trừ khi cần tra cứu chi tiết
- Nếu bị stuck → xem section tương ứng trong full plan

## Key References (không cần mở nếu không cần)

| Thứ cần biết | Tìm ở đâu |
|--------------|-----------|
| Form struct fields đầy đủ | Full plan section 4.3 |
| Walrus endpoints | Full plan section 8.1 |
| Seal seal_approve pattern | Full plan section 4.4 |
| Submission index flow | Full plan section 9.2c |
| Test cases đầy đủ | Full plan section 11 + 12 |
| .env.example đầy đủ | Full plan section 14 |
