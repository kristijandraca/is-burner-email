// Command burner provides a CLI for the burner package.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	burner "github.com/kristijandraca/is-burner-email/packages/go"
)

const helpText = `burner — burner / disposable email detection

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
`

// parseArgs mirrors the other language CLIs: flags can appear in any position,
// the first non-flag argument is treated as the email.
func parseArgs(args []string) (strict, asJSON, stats, help bool, email string) {
	for _, a := range args {
		switch a {
		case "-h", "--help":
			help = true
		case "--strict":
			strict = true
		case "--json":
			asJSON = true
		case "--stats":
			stats = true
		default:
			if email == "" && !strings.HasPrefix(a, "-") {
				email = a
			}
		}
	}
	return
}

func main() {
	strict, asJSON, stats, help, email := parseArgs(os.Args[1:])

	if help {
		fmt.Fprint(os.Stdout, helpText)
		os.Exit(0)
	}

	if stats {
		sizes := burner.GetListSizes()
		if asJSON {
			out := map[string]int{
				"blacklist": sizes.Blacklist,
				"whitelist": sizes.Whitelist,
				"graylist":  sizes.Graylist,
			}
			_ = json.NewEncoder(os.Stdout).Encode(out)
		} else {
			fmt.Printf("blacklist: %d\nwhitelist: %d\ngraylist:  %d\n",
				sizes.Blacklist, sizes.Whitelist, sizes.Graylist)
		}
		os.Exit(0)
	}

	if email == "" {
		fmt.Fprintln(os.Stderr, "Error: missing email argument")
		fmt.Fprint(os.Stderr, "\n"+helpText)
		os.Exit(2)
	}

	mode := burner.ModeNormal
	if strict {
		mode = burner.ModeStrict
	}

	result := burner.Check(email, mode)

	if result.Reason == "invalid-email" {
		fmt.Fprintf(os.Stderr, "Error: invalid email: %s\n", email)
		os.Exit(2)
	}

	if asJSON {
		out := map[string]any{
			"burner": result.Burner,
			"domain": result.Domain,
			"list":   result.List,
			"reason": result.Reason,
			"mode":   string(mode),
		}
		_ = json.NewEncoder(os.Stdout).Encode(out)
	} else {
		label := "OK"
		if result.Burner {
			label = "BURNER"
		}
		listInfo := ""
		if result.List != "" {
			listInfo = fmt.Sprintf(" (%s)", result.List)
		}
		fmt.Printf("%s%s: %s [%s]\n", label, listInfo, result.Domain, result.Reason)
	}

	if result.Burner {
		os.Exit(1)
	}
}
