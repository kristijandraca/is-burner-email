//! Fast, offline burner / disposable email detection.
//!
//! The domain lists are bundled at compile time via [`include_str!`]. Three lists:
//! blacklist (disposable), whitelist (always allowed), graylist (alias /
//! forwarding services — blocked only in strict mode).

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

const BLACKLIST_TEXT: &str = include_str!("../data/blacklist.txt");
const WHITELIST_TEXT: &str = include_str!("../data/whitelist.txt");
const GRAYLIST_TEXT: &str = include_str!("../data/graylist.txt");

/// Selects how graylisted domains are treated.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Mode {
    /// Graylisted domains are allowed (the default).
    #[default]
    Normal,
    /// Graylisted domains are treated as disposable.
    Strict,
}

impl Mode {
    fn as_str(self) -> &'static str {
        match self {
            Mode::Normal => "normal",
            Mode::Strict => "strict",
        }
    }
}

/// Identifies which bundled list matched a given email.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ListName {
    Blacklist,
    Whitelist,
    Graylist,
}

impl ListName {
    /// The wire name used in CLI/JSON output (`"blacklist"`, `"whitelist"`, `"graylist"`).
    pub fn as_str(self) -> &'static str {
        match self {
            ListName::Blacklist => "blacklist",
            ListName::Whitelist => "whitelist",
            ListName::Graylist => "graylist",
        }
    }
}

/// Captures the full classification for an email.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckResult {
    /// Whether the email should be treated as a burner.
    pub burner: bool,
    /// The extracted domain, or `None` when the email is invalid.
    pub domain: Option<String>,
    /// Which bundled list matched, if any.
    pub list: Option<ListName>,
    /// One of: `invalid-email`, `whitelisted`, `blacklisted`,
    /// `graylisted-normal`, `graylisted-strict`, `unknown`.
    pub reason: String,
}

/// Reports how many domains live in each bundled list.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ListSizes {
    pub blacklist: usize,
    pub whitelist: usize,
    pub graylist: usize,
}

fn parse_set(text: &str) -> HashSet<String> {
    let mut set = HashSet::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        set.insert(line.to_lowercase());
    }
    set
}

fn blacklist() -> &'static HashSet<String> {
    static SET: OnceLock<HashSet<String>> = OnceLock::new();
    SET.get_or_init(|| parse_set(BLACKLIST_TEXT))
}

fn whitelist() -> &'static HashSet<String> {
    static SET: OnceLock<HashSet<String>> = OnceLock::new();
    SET.get_or_init(|| parse_set(WHITELIST_TEXT))
}

fn graylist() -> &'static HashSet<String> {
    static SET: OnceLock<HashSet<String>> = OnceLock::new();
    SET.get_or_init(|| parse_set(GRAYLIST_TEXT))
}

fn runtime_blacklist() -> &'static Mutex<HashSet<String>> {
    static SET: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    SET.get_or_init(|| Mutex::new(HashSet::new()))
}

fn runtime_whitelist() -> &'static Mutex<HashSet<String>> {
    static SET: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    SET.get_or_init(|| Mutex::new(HashSet::new()))
}

fn extract_domain(email: &str) -> Option<String> {
    let email = email.trim();
    let at = email.rfind('@')?;
    // `@` must have characters on both sides.
    if at == 0 || at == email.len() - 1 {
        return None;
    }
    let domain = email[at + 1..].to_lowercase();
    if !domain.contains('.') {
        return None;
    }
    Some(domain)
}

fn normalize(s: &str) -> String {
    s.trim().to_lowercase()
}

/// Classifies an email and returns the full result.
///
/// Pass [`Mode::Normal`] (default) or [`Mode::Strict`]. Invalid emails return a
/// `CheckResult` with `burner: false`, `domain: None`, and `reason: "invalid-email"`.
pub fn check(email: &str, mode: Mode) -> CheckResult {
    let domain = match extract_domain(email) {
        Some(d) => d,
        None => {
            return CheckResult {
                burner: false,
                domain: None,
                list: None,
                reason: "invalid-email".to_string(),
            }
        }
    };

    let r_white = runtime_whitelist().lock().unwrap().contains(&domain);
    let r_black = runtime_blacklist().lock().unwrap().contains(&domain);

    if r_white || whitelist().contains(&domain) {
        return CheckResult {
            burner: false,
            domain: Some(domain),
            list: Some(ListName::Whitelist),
            reason: "whitelisted".to_string(),
        };
    }
    if r_black || blacklist().contains(&domain) {
        return CheckResult {
            burner: true,
            domain: Some(domain),
            list: Some(ListName::Blacklist),
            reason: "blacklisted".to_string(),
        };
    }
    if graylist().contains(&domain) {
        return if mode == Mode::Strict {
            CheckResult {
                burner: true,
                domain: Some(domain),
                list: Some(ListName::Graylist),
                reason: "graylisted-strict".to_string(),
            }
        } else {
            CheckResult {
                burner: false,
                domain: Some(domain),
                list: Some(ListName::Graylist),
                reason: "graylisted-normal".to_string(),
            }
        };
    }
    CheckResult {
        burner: false,
        domain: Some(domain),
        list: None,
        reason: "unknown".to_string(),
    }
}

/// Returns whether an email should be treated as a burner under the given mode.
pub fn is_burner(email: &str, mode: Mode) -> bool {
    check(email, mode).burner
}

/// Adds a domain to the runtime blacklist.
pub fn add_to_blacklist(domain: &str) {
    runtime_blacklist().lock().unwrap().insert(normalize(domain));
}

/// Adds a domain to the runtime whitelist.
pub fn add_to_whitelist(domain: &str) {
    runtime_whitelist().lock().unwrap().insert(normalize(domain));
}

/// Removes a domain from the runtime blacklist. Returns whether it was present.
pub fn remove_from_blacklist(domain: &str) -> bool {
    runtime_blacklist().lock().unwrap().remove(&normalize(domain))
}

/// Removes a domain from the runtime whitelist. Returns whether it was present.
pub fn remove_from_whitelist(domain: &str) -> bool {
    runtime_whitelist().lock().unwrap().remove(&normalize(domain))
}

/// Returns the sizes of the three bundled lists.
pub fn get_list_sizes() -> ListSizes {
    ListSizes {
        blacklist: blacklist().len(),
        whitelist: whitelist().len(),
        graylist: graylist().len(),
    }
}

/// Exposes [`Mode::as_str`] for the CLI's JSON output without widening the
/// public surface of the enum's representation.
#[doc(hidden)]
pub fn mode_str(mode: Mode) -> &'static str {
    mode.as_str()
}
