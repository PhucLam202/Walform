#[allow(lint(self_transfer))]
module walform::form {
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    // ===== Error codes =====

    const E_EMPTY_TITLE: u64     = 0;
    const E_EMPTY_BLOB_ID: u64   = 1;
    const E_WRONG_CAP: u64       = 2;
    const E_DUPLICATE_ADMIN: u64 = 3;
    const E_FORM_INACTIVE: u64   = 4;

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
        annotations_blob_id: Option<vector<u8>>,
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

    public struct AnnotationsBlobUpdated has copy, drop {
        form_id: ID,
        blob_id: vector<u8>,
    }

    public struct AdminGranted has copy, drop {
        form_id: ID,
        admin_address: address,
    }

    public struct SubmissionRecorded has copy, drop {
        form_id: ID,
        submission_count: u64,
    }

    // ===== Functions =====

    public fun create_form(
        title: String,
        description: String,
        form_type: String,
        config_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!std::string::is_empty(&title), E_EMPTY_TITLE);
        assert!(!vector::is_empty(&config_blob_id), E_EMPTY_BLOB_ID);

        let owner = ctx.sender();
        let form_uid = object::new(ctx);
        let form_id = object::uid_to_inner(&form_uid);
        let now = clock::timestamp_ms(clock);

        let mut admin_list = vector[];
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
            annotations_blob_id: option::none(),
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

    public fun toggle_active(form: &mut Form, cap: &AdminCap) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        form.is_active = !form.is_active;
        event::emit(FormToggled {
            form_id: object::id(form),
            is_active: form.is_active,
        });
    }

    public fun update_config_blob(
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

    public fun update_submissions_index(
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
        let blob_ref = *option::borrow(&form.submissions_index_blob_id);
        event::emit(SubmissionsIndexUpdated {
            form_id: object::id(form),
            index_blob_id: blob_ref,
            updated_at: now,
        });
    }

    public fun update_annotations_blob(
        form: &mut Form,
        cap: &AdminCap,
        blob_id: vector<u8>,
    ) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        assert!(!vector::is_empty(&blob_id), E_EMPTY_BLOB_ID);
        form.annotations_blob_id = option::some(blob_id);
        let blob_ref = *option::borrow(&form.annotations_blob_id);
        event::emit(AnnotationsBlobUpdated {
            form_id: object::id(form),
            blob_id: blob_ref,
        });
    }

    public fun grant_admin(
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

    /// Called by frontend after recording a submission blob on Walrus.
    public fun record_submission(form: &mut Form, cap: &AdminCap) {
        assert!(cap.form_id == object::id(form), E_WRONG_CAP);
        assert!(form.is_active, E_FORM_INACTIVE);
        form.submission_count = form.submission_count + 1;
        event::emit(SubmissionRecorded {
            form_id: object::id(form),
            submission_count: form.submission_count,
        });
    }

    // ===== Getters =====

    public fun cap_form_id(cap: &AdminCap): ID { cap.form_id }
    public fun is_active(form: &Form): bool { form.is_active }
    public fun owner(form: &Form): address { form.owner }
    public fun admin_list(form: &Form): &vector<address> { &form.admin_list }
    public fun submission_count(form: &Form): u64 { form.submission_count }
    public fun version(form: &Form): u64 { form.version }
    public fun config_blob_id(form: &Form): &vector<u8> { &form.config_blob_id }
    public fun submissions_index_blob_id(form: &Form): &Option<vector<u8>> {
        &form.submissions_index_blob_id
    }

    public fun annotations_blob_id(form: &Form): &Option<vector<u8>> {
        &form.annotations_blob_id
    }

    public fun is_admin(form: &Form, addr: address): bool {
        addr == form.owner || vector::contains(&form.admin_list, &addr)
    }

    // ===== Test helpers =====

    #[test_only]
    public fun e_empty_title(): u64 { E_EMPTY_TITLE }
    #[test_only]
    public fun e_empty_blob_id(): u64 { E_EMPTY_BLOB_ID }
    #[test_only]
    public fun e_wrong_cap(): u64 { E_WRONG_CAP }
    #[test_only]
    public fun e_duplicate_admin(): u64 { E_DUPLICATE_ADMIN }
    #[test_only]
    public fun e_form_inactive(): u64 { E_FORM_INACTIVE }
}
