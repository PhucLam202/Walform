#[test_only]
module walform::form_tests {
    use walform::form::{Self, Form, AdminCap};
    use walform::policy;
    use sui::test_scenario::{Self as ts};
    use sui::clock;

    const OWNER: address = @0xA;
    const OTHER: address = @0xB;

    // Mirror error codes from form.move for use in expected_failure attributes
    const E_EMPTY_TITLE: u64     = 0;
    const E_EMPTY_BLOB_ID: u64   = 1;
    const E_WRONG_CAP: u64       = 2;
    const E_DUPLICATE_ADMIN: u64 = 3;
    const E_FORM_INACTIVE: u64   = 4;

    // ===== form.move tests =====

    #[test]
    fun test_create_form_success() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Test Form".to_string(),
                b"Description".to_string(),
                b"survey".to_string(),
                b"validBlobId123",
                &clk,
                ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            assert!(ts::has_most_recent_for_sender<Form>(&scenario), 0);
            assert!(ts::has_most_recent_for_sender<AdminCap>(&scenario), 0);
            let f = ts::take_from_sender<Form>(&scenario);
            assert!(form::is_active(&f), 0);
            assert!(form::submission_count(&f) == 0, 0);
            assert!(form::version(&f) == 0, 0);
            ts::return_to_sender(&scenario, f);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_EMPTY_TITLE, location = walform::form)]
    fun test_create_form_empty_title() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"".to_string(),
                b"desc".to_string(),
                b"survey".to_string(),
                b"validBlob",
                &clk,
                ts::ctx(&mut scenario),
            );
        };
        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_EMPTY_BLOB_ID, location = walform::form)]
    fun test_create_form_empty_blob() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Title".to_string(),
                b"desc".to_string(),
                b"survey".to_string(),
                b"",
                &clk,
                ts::ctx(&mut scenario),
            );
        };
        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_toggle_active() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"T".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            assert!(form::is_active(&f), 0);
            form::toggle_active(&mut f, &cap);
            assert!(!form::is_active(&f), 0);
            // toggle back
            form::toggle_active(&mut f, &cap);
            assert!(form::is_active(&f), 0);
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_WRONG_CAP, location = walform::form)]
    fun test_toggle_active_wrong_cap() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form1".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob1", &clk, ts::ctx(&mut scenario),
            );
        };
        ts::next_tx(&mut scenario, OTHER);
        {
            form::create_form(
                b"Form2".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob2", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut form1 = ts::take_from_address<Form>(&scenario, OWNER);
            let cap2 = ts::take_from_address<AdminCap>(&scenario, OTHER);
            form::toggle_active(&mut form1, &cap2); // must abort
            ts::return_to_address(OWNER, form1);
            ts::return_to_address(OTHER, cap2);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_update_config_blob() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blobV0", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            assert!(form::version(&f) == 0, 0);
            form::update_config_blob(&mut f, &cap, b"blobV1");
            assert!(form::version(&f) == 1, 0);
            assert!(*form::config_blob_id(&f) == b"blobV1", 0);
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_EMPTY_BLOB_ID, location = walform::form)]
    fun test_update_config_blob_empty() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blobV0", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            form::update_config_blob(&mut f, &cap, b""); // must abort
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_update_submissions_index() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            assert!(option::is_none(form::submissions_index_blob_id(&f)), 0);
            form::update_submissions_index(&mut f, &cap, b"indexBlob", &clk);
            assert!(option::is_some(form::submissions_index_blob_id(&f)), 0);
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_grant_admin() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            assert!(!form::is_admin(&f, OTHER), 0);
            form::grant_admin(&mut f, &cap, OTHER);
            assert!(form::is_admin(&f, OTHER), 0);
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_DUPLICATE_ADMIN, location = walform::form)]
    fun test_grant_admin_duplicate() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            form::grant_admin(&mut f, &cap, OTHER);
            form::grant_admin(&mut f, &cap, OTHER); // must abort
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    fun test_record_submission() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            assert!(form::submission_count(&f) == 0, 0);
            form::record_submission(&mut f, &cap);
            assert!(form::submission_count(&f) == 1, 0);
            form::record_submission(&mut f, &cap);
            assert!(form::submission_count(&f) == 2, 0);
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_FORM_INACTIVE, location = walform::form)]
    fun test_record_submission_inactive() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut f = ts::take_from_sender<Form>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            form::toggle_active(&mut f, &cap); // deactivate
            form::record_submission(&mut f, &cap); // must abort
            ts::return_to_sender(&scenario, f);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_WRONG_CAP, location = walform::form)]
    fun test_record_submission_wrong_cap() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form1".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob1", &clk, ts::ctx(&mut scenario),
            );
        };
        ts::next_tx(&mut scenario, OTHER);
        {
            form::create_form(
                b"Form2".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob2", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut form1 = ts::take_from_address<Form>(&scenario, OWNER);
            let cap2 = ts::take_from_address<AdminCap>(&scenario, OTHER);
            form::record_submission(&mut form1, &cap2); // must abort
            ts::return_to_address(OWNER, form1);
            ts::return_to_address(OTHER, cap2);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    // ===== policy.move tests =====

    #[test]
    fun test_seal_approve_success() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            // id = cap's form_id bytes — should approve without aborting
            let id = object::id_to_bytes(&form::cap_form_id(&cap));
            policy::seal_approve(id, &cap);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0, location = walform::policy)]
    fun test_seal_approve_wrong_id() {
        let mut scenario = ts::begin(OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, OWNER);
        {
            form::create_form(
                b"Form".to_string(), b"".to_string(), b"survey".to_string(),
                b"blob", &clk, ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            // wrong id bytes — must abort
            policy::seal_approve(b"wrong_id_bytes_that_dont_match_at_all_x", &cap);
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }
}
