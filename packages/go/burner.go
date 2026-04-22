// Package burner provides fast, offline burner / disposable email detection.
//
// The domain lists are bundled at compile time via go:embed. Three lists:
// blacklist (disposable), whitelist (always allowed), graylist (alias /
// forwarding services — blocked only in strict mode).
package burner

import (
	_ "embed"
	"strings"
	"sync"
)

//go:embed data/blacklist.txt
var blacklistText string

//go:embed data/whitelist.txt
var whitelistText string

//go:embed data/graylist.txt
var graylistText string

// Mode selects how graylisted domains are treated.
type Mode string

const (
	ModeNormal Mode = "normal"
	ModeStrict Mode = "strict"
)

// ListName identifies which bundled list matched a given email.
type ListName string

const (
	ListBlacklist ListName = "blacklist"
	ListWhitelist ListName = "whitelist"
	ListGraylist  ListName = "graylist"
)

// CheckResult captures the full classification for an email.
type CheckResult struct {
	Burner bool
	Domain string
	List   ListName
	Reason string
}

var (
	blacklist = parseSet(blacklistText)
	whitelist = parseSet(whitelistText)
	graylist  = parseSet(graylistText)

	runtimeMu        sync.RWMutex
	runtimeBlacklist = map[string]struct{}{}
	runtimeWhitelist = map[string]struct{}{}
)

func parseSet(text string) map[string]struct{} {
	s := make(map[string]struct{})
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		s[strings.ToLower(line)] = struct{}{}
	}
	return s
}

func extractDomain(email string) string {
	email = strings.TrimSpace(email)
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return ""
	}
	domain := strings.ToLower(email[at+1:])
	if !strings.Contains(domain, ".") {
		return ""
	}
	return domain
}

func normalize(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// Check classifies an email and returns the full result.
//
// Pass ModeNormal (default) or ModeStrict. An empty Mode is treated as ModeNormal.
func Check(email string, mode Mode) CheckResult {
	if mode == "" {
		mode = ModeNormal
	}
	domain := extractDomain(email)
	if domain == "" {
		return CheckResult{Burner: false, Reason: "invalid-email"}
	}

	runtimeMu.RLock()
	_, rWhite := runtimeWhitelist[domain]
	_, rBlack := runtimeBlacklist[domain]
	runtimeMu.RUnlock()

	if rWhite {
		return CheckResult{Burner: false, Domain: domain, List: ListWhitelist, Reason: "whitelisted"}
	}
	if _, ok := whitelist[domain]; ok {
		return CheckResult{Burner: false, Domain: domain, List: ListWhitelist, Reason: "whitelisted"}
	}
	if rBlack {
		return CheckResult{Burner: true, Domain: domain, List: ListBlacklist, Reason: "blacklisted"}
	}
	if _, ok := blacklist[domain]; ok {
		return CheckResult{Burner: true, Domain: domain, List: ListBlacklist, Reason: "blacklisted"}
	}
	if _, ok := graylist[domain]; ok {
		if mode == ModeStrict {
			return CheckResult{Burner: true, Domain: domain, List: ListGraylist, Reason: "graylisted-strict"}
		}
		return CheckResult{Burner: false, Domain: domain, List: ListGraylist, Reason: "graylisted-normal"}
	}
	return CheckResult{Burner: false, Domain: domain, Reason: "unknown"}
}

// IsBurner returns whether an email should be treated as a burner under the given mode.
func IsBurner(email string, mode Mode) bool {
	return Check(email, mode).Burner
}

// AddToBlacklist adds a domain to the runtime blacklist.
func AddToBlacklist(domain string) {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	runtimeBlacklist[normalize(domain)] = struct{}{}
}

// AddToWhitelist adds a domain to the runtime whitelist.
func AddToWhitelist(domain string) {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	runtimeWhitelist[normalize(domain)] = struct{}{}
}

// RemoveFromBlacklist removes a domain from the runtime blacklist. Returns whether it was present.
func RemoveFromBlacklist(domain string) bool {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	d := normalize(domain)
	_, ok := runtimeBlacklist[d]
	if ok {
		delete(runtimeBlacklist, d)
	}
	return ok
}

// RemoveFromWhitelist removes a domain from the runtime whitelist. Returns whether it was present.
func RemoveFromWhitelist(domain string) bool {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	d := normalize(domain)
	_, ok := runtimeWhitelist[d]
	if ok {
		delete(runtimeWhitelist, d)
	}
	return ok
}

// ListSizes reports how many domains live in each bundled list.
type ListSizes struct {
	Blacklist int
	Whitelist int
	Graylist  int
}

// GetListSizes returns the sizes of the three bundled lists.
func GetListSizes() ListSizes {
	return ListSizes{
		Blacklist: len(blacklist),
		Whitelist: len(whitelist),
		Graylist:  len(graylist),
	}
}
