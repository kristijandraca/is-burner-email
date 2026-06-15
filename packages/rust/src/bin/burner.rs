//! CLI for the is-burner-email crate.

use std::process::ExitCode;

use is_burner_email::{check, get_list_sizes, mode_str, Mode};

const HELP_TEXT: &str = "burner — burner / disposable email detection

Usage:
  burner <email> [--strict] [--json]
  burner --stats
  burner --help

Options:
  --strict    Use strict mode (graylisted domains are treated as disposable)
  --json      Output full check result as JSON
  --stats     Print the sizes of the bundled lists
  -h, --help  Show this help

Exit codes:
  0  not a burner
  1  burner
  2  invalid input / error
";

struct Args {
    strict: bool,
    as_json: bool,
    stats: bool,
    help: bool,
    email: Option<String>,
}

// Mirrors the other language CLIs: flags can appear in any position,
// the first non-flag argument is treated as the email.
fn parse_args(args: impl Iterator<Item = String>) -> Args {
    let mut parsed = Args {
        strict: false,
        as_json: false,
        stats: false,
        help: false,
        email: None,
    };
    for a in args {
        match a.as_str() {
            "-h" | "--help" => parsed.help = true,
            "--strict" => parsed.strict = true,
            "--json" => parsed.as_json = true,
            "--stats" => parsed.stats = true,
            _ => {
                if parsed.email.is_none() && !a.starts_with('-') {
                    parsed.email = Some(a);
                }
            }
        }
    }
    parsed
}

fn main() -> ExitCode {
    let args = parse_args(std::env::args().skip(1));

    if args.help {
        print!("{HELP_TEXT}");
        return ExitCode::from(0);
    }

    if args.stats {
        let sizes = get_list_sizes();
        if args.as_json {
            println!(
                "{{\"blacklist\":{},\"whitelist\":{},\"graylist\":{}}}",
                sizes.blacklist, sizes.whitelist, sizes.graylist
            );
        } else {
            println!(
                "blacklist: {}\nwhitelist: {}\ngraylist:  {}",
                sizes.blacklist, sizes.whitelist, sizes.graylist
            );
        }
        return ExitCode::from(0);
    }

    let email = match args.email {
        Some(e) => e,
        None => {
            eprintln!("Error: missing email argument");
            eprint!("\n{HELP_TEXT}");
            return ExitCode::from(2);
        }
    };

    let mode = if args.strict { Mode::Strict } else { Mode::Normal };
    let result = check(&email, mode);

    if result.reason == "invalid-email" {
        eprintln!("Error: invalid email: {email}");
        return ExitCode::from(2);
    }

    let domain = result.domain.unwrap_or_default();
    let list = result.list.map(|l| l.as_str()).unwrap_or("");

    if args.as_json {
        println!(
            "{{\"burner\":{},\"domain\":\"{}\",\"list\":\"{}\",\"reason\":\"{}\",\"mode\":\"{}\"}}",
            result.burner,
            domain,
            list,
            result.reason,
            mode_str(mode)
        );
    } else {
        let label = if result.burner { "BURNER" } else { "OK" };
        let list_info = if list.is_empty() {
            String::new()
        } else {
            format!(" ({list})")
        };
        println!("{label}{list_info}: {domain} [{}]", result.reason);
    }

    if result.burner {
        ExitCode::from(1)
    } else {
        ExitCode::from(0)
    }
}
