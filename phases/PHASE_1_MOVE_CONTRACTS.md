# Phase 1 — Move Smart Contracts

> **Mục tiêu:** `form.move` + `policy.move` compile, test pass, deploy testnet
> **Thời gian:** ~4h
> **Cần trước:** Phase 0 hoàn thành
> **Status:** ⬜ TODO

---

## ⚠️ ĐỌC TRƯỚC KHI CODE (15 phút)

**Bắt buộc:** Mở và đọc https://github.com/MystenLabs/seal/tree/main/examples/move

Xác nhận:
- [ ] `seal_approve` function signature 2026 — xem file ví dụ gần nhất với whitelist/ownership pattern
- [ ] Function là `public fun` (không phải `entry fun`)
- [ ] Cách Seal dry_run PTB hoạt động

---

## 1.1 Implement `form.move`

**File:** `walform-contracts/sources/form.move`

```move
module walform::form {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;
    use std::option::{Self, Option};
    use std::vector;

    // ===== Error codes =====
    const E_EMPTY_TITLE: u64     = 0;
    const E_EMPTY_BLOB_ID: u64   = 1;
    const E_WRONG_CAP: u64       = 2;
    const E_DUPLICATE_ADMIN: u64 = 3;

    // ===== Structs =====

    public struct Form has key, store {
        id: UID,
        owner: address,
        title: String,
        description: String,
        form_type: String,
        version: u64,
        config_blob_id: vector<u8>,
        submissions_index_blob_id: Option<vector<u8>>,
        last_index_updated: u64,
        admin_list: vector<address>,
        is_active: bool,
        submission_count: u64,
        created_at: u64,
    }

    public struct AdminCap has key, store {
        id: UID,
        form_id: ID,
    }

    // ===== Events =====

    public struct FormCreated has copy, drop {
        form_id: ID,
        owner: address,
        form_type: String,
        config_blob_id: vector<u8>,
        created_at: u64,
    }

    public struct FormToggled has copy, drop {
        form_id: ID,
        is_active: bool,
    }

    public struct FormConfigUpdated has copy, drop {
        form_id: ID,
        new_blob_id: vector<u8>,
        new_version: u64,
    }

    public struct SubmissionsIndexUpdated has copy, drop {
        form_id: ID,
        index_blob_id: vector<u8>,
        updated_at: u64,
    }

    public struct AdminGranted has copy, drop {
        form_id: ID,
        admin_address: address,
    }

    // ===== Entry Functions =====

    public entry fun create_form(
        title: String,
        description: String,
        form_type: String,
        config_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!std::string::is_empty(&title), E_EMPTY_TITLE);
        assert!(!vector::is_empty(&config_blob_id), E_EMPTY_BLOB_ID);

        let owner = tx_context::sender(ctx);
        let form_uid = object::new(ctx);
        let form_id = object::uid_to_inner(&form_uid);
        let now = clock::timestamp_ms(clock);

        // Owner luôn có trong admin_list để is_admin() nhất quán
        let mut admin_list = vector::empty<address>();
        vector::push_back(&mut admin_list, owner);

        let form = Form {
            id: form_uid,
            owner,
            title,
            description,
            form_type,
            version: 0,
            config_blob_id,
            submissions_index_blob_id: option::none(),
            last_index_updated: 0,
            admin_list,
            is_active: true,
            submission_count: 0,
            created_at: now,
        };

        let cap = AdminCap {
            id: object::new(ctx),
            form_id,
        };

        event::emit(FormCreated {
            form_id,
            owner,
            form_type: form.form_type,
            config_blob_id: form.config_blob_id,
            created_at: now,
        });

        transfer::transfer(form, owner);
        transfer::transfer(cap, owner);
    }

    public entry fun toggle_active(form: &mut Form, cap: &AdminCap) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        form.is_active = !form.is_active;
        event::emit(FormToggled {
            form_id: object::id(form),
            is_active: form.is_active,
        });
    }

    public entry fun update_config_blob(
        form: &mut Form,
        cap: &AdminCap,
        new_blob_id: vector<u8>,
    ) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        assert!(!vector::is_empty(&new_blob_id), E_EMPTY_BLOB_ID);
        form.config_blob_id = new_blob_id;
        form.version = form.version + 1;
        event::emit(FormConfigUpdated {
            form_id: object::id(form),
            new_blob_id: form.config_blob_id,
            new_version: form.version,
        });
    }

    public entry fun update_submissions_index(
        form: &mut Form,
        cap: &AdminCap,
        index_blob_id: vector<u8>,
        clock: &Clock,
    ) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        assert!(!vector::is_empty(&index_blob_id), E_EMPTY_BLOB_ID);
        let now = clock::timestamp_ms(clock);
        form.submissions_index_blob_id = option::some(index_blob_id);
        form.last_index_updated = now;
        event::emit(SubmissionsIndexUpdated {
            form_id: object::id(form),
            index_blob_id: *option::borrow(&form.submissions_index_blob_id),
            updated_at: now,
        });
    }

    public entry fun grant_admin(
        form: &mut Form,
        cap: &AdminCap,
        admin_address: address,
    ) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        assert!(!vector::contains(&form.admin_list, &admin_address), E_DUPLICATE_ADMIN);
        vector::push_back(&mut form.admin_list, admin_address);
        event::emit(AdminGranted {
            form_id: object::id(form),
            admin_address,
        });
    }

    // ===== Getters =====

    public fun cap_form_id(cap: &AdminCap): ID { cap.form_id }
    public fun is_active(form: &Form): bool { form.is_active }
    public fun owner(form: &Form): address { form.owner }
    public fun admin_list(form: &Form): &vector<address> { &form.admin_list }

    public fun is_admin(form: &Form, addr: address): bool {
        addr == form.owner || vector::contains(&form.admin_list, &addr)
    }
}
```

- [ ] File tạo xong
- [ ] `sui move build` pass

---

## 1.2 Implement `policy.move`

**⚠️ Sau khi đọc Seal examples/move, điều chỉnh signature nếu cần.**

**File:** `walform-contracts/sources/policy.move`

```move
module walform::policy {
    use walform::form::{AdminCap, cap_form_id};
    use sui::object;

    // Seal 2026: NON-ENTRY function.
    // Key servers dry_run PTB: [borrow AdminCap] → [call seal_approve(id, cap)]
    // id = formId bytes (set lúc encrypt, dùng làm policy namespace)
    // Xem: https://github.com/MystenLabs/seal/tree/main/examples/move
    public fun seal_approve(
        id: vector<u8>,
        cap: &AdminCap,
    ): bool {
        let cap_id_bytes = object::id_to_bytes(&cap_form_id(cap));
        cap_id_bytes == id
    }
}
```

- [ ] File tạo xong
- [ ] `sui move build` pass (cả 2 module)

---

## 1.3 Viết Move Unit Tests

Thêm test module vào cuối `form.move` (sau closing `}`):

```move
#[test_only]
module walform::form_tests {
    use walform::form;
    use sui::test_scenario;
    use sui::clock;

    const OWNER: address = @0xA;
    const OTHER: address = @0xB;

    #[test]
    fun test_create_form_success() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                std::string::utf8(b"Test Form"),
                std::string::utf8(b"Description"),
                std::string::utf8(b"survey"),
                b"validBlobId123",
                &clock,
                test_scenario::ctx(&mut scenario),
            );
        };

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            // Form và AdminCap phải tồn tại trong owned objects của OWNER
            assert!(test_scenario::has_most_recent_for_sender<form::Form>(&scenario), 0);
            assert!(test_scenario::has_most_recent_for_sender<form::AdminCap>(&scenario), 0);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = form::E_EMPTY_TITLE)]
    fun test_create_form_empty_title() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                std::string::utf8(b""),
                std::string::utf8(b"desc"),
                std::string::utf8(b"survey"),
                b"validBlob",
                &clock,
                test_scenario::ctx(&mut scenario),
            );
        };
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = form::E_EMPTY_BLOB_ID)]
    fun test_create_form_empty_blob() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                std::string::utf8(b"Title"),
                std::string::utf8(b"desc"),
                std::string::utf8(b"survey"),
                b"",
                &clock,
                test_scenario::ctx(&mut scenario),
            );
        };
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_toggle_active() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, OWNER);
        { form::create_form(std::string::utf8(b"T"), std::string::utf8(b""), std::string::utf8(b"survey"), b"blob", &clock, test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut form = test_scenario::take_from_sender<form::Form>(&scenario);
            let cap = test_scenario::take_from_sender<form::AdminCap>(&scenario);
            assert!(form::is_active(&form), 0);
            form::toggle_active(&mut form, &cap);
            assert!(!form::is_active(&form), 0);
            test_scenario::return_to_sender(&scenario, form);
            test_scenario::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = form::E_WRONG_CAP)]
    fun test_toggle_active_wrong_cap() {
        // Tạo 2 forms, dùng cap của form 2 để toggle form 1 → phải fail
        let mut scenario = test_scenario::begin(OWNER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, OWNER);
        { form::create_form(std::string::utf8(b"Form1"), std::string::utf8(b""), std::string::utf8(b"survey"), b"blob1", &clock, test_scenario::ctx(&mut scenario)); };
        test_scenario::next_tx(&mut scenario, OTHER);
        { form::create_form(std::string::utf8(b"Form2"), std::string::utf8(b""), std::string::utf8(b"survey"), b"blob2", &clock, test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut form1 = test_scenario::take_from_address<form::Form>(&scenario, OWNER);
            let cap2 = test_scenario::take_from_address<form::AdminCap>(&scenario, OTHER);
            form::toggle_active(&mut form1, &cap2); // phải abort
            test_scenario::return_to_address(OWNER, form1);
            test_scenario::return_to_address(OTHER, cap2);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}
```

> **Note:** Error constants cần được `public` để test access. Cập nhật:
> ```move
> public const E_EMPTY_TITLE: u64  = 0;
> public const E_EMPTY_BLOB_ID: u64 = 1;
> public const E_WRONG_CAP: u64    = 2;
> ```

```bash
cd walform-contracts
sui move test
```

- [ ] `test_create_form_success` PASS
- [ ] `test_create_form_empty_title` PASS
- [ ] `test_create_form_empty_blob` PASS
- [ ] `test_toggle_active` PASS
- [ ] `test_toggle_active_wrong_cap` PASS

---

## 1.4 Deploy lên Testnet

```bash
# Đảm bảo đang dùng testnet và có SUI testnet
sui client switch --env testnet
sui client gas   # phải có gas

# Lấy testnet SUI nếu cần:
# https://faucet.sui.io hoặc discord faucet

sui client publish --gas-budget 300000000 2>&1 | tee publish_output.txt
```

Copy từ output:
```
Package ID: 0x...  ← PACKAGE_ID
```

Cập nhật `walform/.env.local`:
```
NEXT_PUBLIC_PACKAGE_ID=0x<package_id_vừa_lấy>
```

- [ ] Publish thành công
- [ ] packageId đã lưu vào `.env.local`
- [ ] packageId đã lưu vào `phases/KNOWN_IDS.md` (tạo file này)

---

## 1.5 Verify thủ công bằng CLI

```bash
# Thay PKG bằng packageId thực
PKG="0x<package_id>"

sui client call \
  --package $PKG \
  --module form \
  --function create_form \
  --args '"Test Form"' '"My first WalForm"' '"survey"' \
  '"dGVzdEJsb2JJZA=="' \
  @0x6 \
  --gas-budget 10000000
```

Sau đó:
```bash
sui client objects   # Phải thấy Form object và AdminCap
```

- [ ] Form object xuất hiện trong owned objects
- [ ] AdminCap xuất hiện trong owned objects
- [ ] Xem trên https://testnet.suivision.xyz/object/<formId>

---

## 1.6 Tạo `phases/KNOWN_IDS.md`

```markdown
# Known Contract IDs

## Testnet
- Package ID: 0x...
- Deployed at: 2026-05-07
- Form type: 0x...::form::Form
- AdminCap type: 0x...::form::AdminCap

## Mainnet (điền sau Phase cuối)
- Package ID: TODO
```

- [ ] File tạo và điền đầy đủ

---

## ✅ Checkpoint Phase 1

- [ ] `sui move build` — zero warnings
- [ ] `sui move test` — 5/5 tests pass
- [ ] Package deployed testnet thành công
- [ ] `create_form` gọi được, Form + AdminCap trong owned objects
- [ ] packageId lưu vào `.env.local` và `KNOWN_IDS.md`

**Done → sang [PHASE_2_WALRUS_LIB.md](./PHASE_2_WALRUS_LIB.md)**
