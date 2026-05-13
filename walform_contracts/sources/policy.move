module walform::policy {
    use walform::form::{AdminCap, cap_form_id};

    // Seal key servers call this function via dry-run PTB to decide whether
    // to approve decryption. The `id` is the policy namespace bytes set at
    // encrypt time (= Form object ID bytes). Approval is granted only when
    // the caller presents the AdminCap whose form_id matches that ID.
    public fun seal_approve(
        id: vector<u8>,
        cap: &AdminCap,
    ) {
        let cap_id_bytes = object::id_to_bytes(&cap_form_id(cap));
        assert!(cap_id_bytes == id, 0);
    }
}
