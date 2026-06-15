use is_burner_email::{
    add_to_blacklist, add_to_whitelist, check, get_list_sizes, is_burner, remove_from_blacklist,
    remove_from_whitelist, ListName, Mode,
};

#[test]
fn invalid_email() {
    let cases = ["", "not-an-email", "@example.com", "foo@", "foo@localhost"];
    for c in cases {
        let r = check(c, Mode::Normal);
        assert_eq!(r.reason, "invalid-email", "check({c:?}) reason");
        assert_eq!(r.domain, None, "check({c:?}) domain");
    }
}

#[test]
fn lowercase_and_trim() {
    let r = check("  User@GMail.COM  ", Mode::Normal);
    assert_eq!(r.domain.as_deref(), Some("gmail.com"));
}

#[test]
fn whitelist() {
    let r = check("user@gmail.com", Mode::Normal);
    assert!(!r.burner, "gmail.com should not be a burner");
    assert_eq!(r.list, Some(ListName::Whitelist));
    assert_eq!(r.reason, "whitelisted");
}

#[test]
fn whitelist_overrides_both_modes() {
    assert!(!is_burner("user@gmail.com", Mode::Normal));
    assert!(!is_burner("user@gmail.com", Mode::Strict));
}

#[test]
fn graylist_normal() {
    let r = check("user@duck.com", Mode::Normal);
    assert!(!r.burner, "duck.com should not be burner in normal mode");
    assert_eq!(r.list, Some(ListName::Graylist));
    assert_eq!(r.reason, "graylisted-normal");
}

#[test]
fn graylist_strict() {
    let r = check("user@duck.com", Mode::Strict);
    assert!(r.burner, "duck.com should be burner in strict mode");
    assert_eq!(r.list, Some(ListName::Graylist));
    assert_eq!(r.reason, "graylisted-strict");
}

#[test]
fn default_mode_is_normal() {
    // Mode::default() is Normal.
    assert!(!is_burner("user@mozmail.com", Mode::default()));
    assert!(is_burner("user@mozmail.com", Mode::Strict));
}

#[test]
fn unknown_domain() {
    let r = check("user@definitely-not-in-any-list-xyz.example", Mode::Normal);
    assert!(!r.burner, "unknown domain should not be burner");
    assert_eq!(r.list, None);
    assert_eq!(r.reason, "unknown");
}

#[test]
fn runtime_blacklist() {
    const D: &str = "runtime-block.example";

    assert!(
        !is_burner(&format!("user@{D}"), Mode::Normal),
        "domain should not be burner before blacklisting"
    );
    add_to_blacklist(D);
    let r = check(&format!("user@{D}"), Mode::Normal);
    assert!(r.burner, "domain should be burner after adding to blacklist");
    assert_eq!(r.list, Some(ListName::Blacklist));

    remove_from_blacklist(D);
}

#[test]
fn whitelist_rescues_graylisted() {
    const D: &str = "simplelogin.com";

    assert!(
        is_burner(&format!("user@{D}"), Mode::Strict),
        "simplelogin.com should be burner in strict mode by default"
    );
    add_to_whitelist(D);
    assert!(
        !is_burner(&format!("user@{D}"), Mode::Strict),
        "runtime whitelist should rescue graylisted in strict mode"
    );
    remove_from_whitelist(D);
    assert!(
        is_burner(&format!("user@{D}"), Mode::Strict),
        "removal should restore graylisted behavior in strict mode"
    );
}

#[test]
fn whitelist_wins_over_blacklist() {
    const D: &str = "contested.example";

    add_to_blacklist(D);
    add_to_whitelist(D);
    assert!(
        !is_burner(&format!("user@{D}"), Mode::Normal),
        "runtime whitelist should win over runtime blacklist"
    );

    remove_from_blacklist(D);
    remove_from_whitelist(D);
}

#[test]
fn normalizes_casing_and_whitespace() {
    const D: &str = "badguy.example";

    add_to_blacklist("  BadGuy.EXAMPLE  ");
    assert!(
        is_burner(&format!("user@{D}"), Mode::Normal),
        "runtime blacklist should normalize casing/whitespace"
    );

    remove_from_blacklist(D);
}

#[test]
fn list_sizes() {
    let sizes = get_list_sizes();
    assert!(sizes.blacklist > 0, "blacklist size should be > 0");
    assert!(sizes.whitelist > 0, "whitelist size should be > 0");
    assert!(sizes.graylist > 0, "graylist size should be > 0");
}
