package burner_test

import (
	"testing"

	burner "github.com/kristijandraca/is-burner-email/packages/go"
)

func TestInvalidEmail(t *testing.T) {
	cases := []string{
		"",
		"not-an-email",
		"@example.com",
		"foo@",
		"foo@localhost",
	}
	for _, c := range cases {
		r := burner.Check(c, burner.ModeNormal)
		if r.Reason != "invalid-email" {
			t.Errorf("Check(%q) reason = %q, want invalid-email", c, r.Reason)
		}
	}
}

func TestLowercaseAndTrim(t *testing.T) {
	r := burner.Check("  User@GMail.COM  ", burner.ModeNormal)
	if r.Domain != "gmail.com" {
		t.Errorf("domain = %q, want gmail.com", r.Domain)
	}
}

func TestWhitelist(t *testing.T) {
	r := burner.Check("user@gmail.com", burner.ModeNormal)
	if r.Burner {
		t.Error("gmail.com should not be a burner")
	}
	if r.List != burner.ListWhitelist {
		t.Errorf("list = %q, want whitelist", r.List)
	}
	if r.Reason != "whitelisted" {
		t.Errorf("reason = %q, want whitelisted", r.Reason)
	}
}

func TestWhitelistOverridesBothModes(t *testing.T) {
	if burner.IsBurner("user@gmail.com", burner.ModeNormal) {
		t.Error("gmail.com should not be burner in normal mode")
	}
	if burner.IsBurner("user@gmail.com", burner.ModeStrict) {
		t.Error("gmail.com should not be burner in strict mode")
	}
}

func TestGraylistNormal(t *testing.T) {
	r := burner.Check("user@duck.com", burner.ModeNormal)
	if r.Burner {
		t.Error("duck.com should not be burner in normal mode")
	}
	if r.List != burner.ListGraylist {
		t.Errorf("list = %q, want graylist", r.List)
	}
	if r.Reason != "graylisted-normal" {
		t.Errorf("reason = %q, want graylisted-normal", r.Reason)
	}
}

func TestGraylistStrict(t *testing.T) {
	r := burner.Check("user@duck.com", burner.ModeStrict)
	if !r.Burner {
		t.Error("duck.com should be burner in strict mode")
	}
	if r.List != burner.ListGraylist {
		t.Errorf("list = %q, want graylist", r.List)
	}
	if r.Reason != "graylisted-strict" {
		t.Errorf("reason = %q, want graylisted-strict", r.Reason)
	}
}

func TestDefaultModeIsNormal(t *testing.T) {
	if burner.IsBurner("user@mozmail.com", "") {
		t.Error("default mode should allow mozmail.com (graylisted)")
	}
	if !burner.IsBurner("user@mozmail.com", burner.ModeStrict) {
		t.Error("strict mode should block mozmail.com (graylisted)")
	}
}

func TestUnknownDomain(t *testing.T) {
	r := burner.Check("user@definitely-not-in-any-list-xyz.example", burner.ModeNormal)
	if r.Burner {
		t.Error("unknown domain should not be burner")
	}
	if r.List != "" {
		t.Errorf("list = %q, want empty", r.List)
	}
	if r.Reason != "unknown" {
		t.Errorf("reason = %q, want unknown", r.Reason)
	}
}

func TestRuntimeBlacklist(t *testing.T) {
	const d = "runtime-block.example"
	defer burner.RemoveFromBlacklist(d)

	if burner.IsBurner("user@"+d, burner.ModeNormal) {
		t.Error("domain should not be burner before blacklisting")
	}
	burner.AddToBlacklist(d)
	r := burner.Check("user@"+d, burner.ModeNormal)
	if !r.Burner {
		t.Error("domain should be burner after adding to blacklist")
	}
	if r.List != burner.ListBlacklist {
		t.Errorf("list = %q, want blacklist", r.List)
	}
}

func TestWhitelistRescuesGraylisted(t *testing.T) {
	const d = "simplelogin.com"
	defer burner.RemoveFromWhitelist(d)

	if !burner.IsBurner("user@"+d, burner.ModeStrict) {
		t.Error("simplelogin.com should be burner in strict mode by default")
	}
	burner.AddToWhitelist(d)
	if burner.IsBurner("user@"+d, burner.ModeStrict) {
		t.Error("runtime whitelist should rescue graylisted in strict mode")
	}
	burner.RemoveFromWhitelist(d)
	if !burner.IsBurner("user@"+d, burner.ModeStrict) {
		t.Error("removal should restore graylisted behavior in strict mode")
	}
}

func TestWhitelistWinsOverBlacklist(t *testing.T) {
	const d = "contested.example"
	defer burner.RemoveFromBlacklist(d)
	defer burner.RemoveFromWhitelist(d)

	burner.AddToBlacklist(d)
	burner.AddToWhitelist(d)
	if burner.IsBurner("user@"+d, burner.ModeNormal) {
		t.Error("runtime whitelist should win over runtime blacklist")
	}
}

func TestNormalizesCasingAndWhitespace(t *testing.T) {
	const d = "badguy.example"
	defer burner.RemoveFromBlacklist(d)

	burner.AddToBlacklist("  BadGuy.EXAMPLE  ")
	if !burner.IsBurner("user@"+d, burner.ModeNormal) {
		t.Error("runtime blacklist should normalize casing/whitespace")
	}
}

func TestListSizes(t *testing.T) {
	sizes := burner.GetListSizes()
	if sizes.Blacklist == 0 {
		t.Error("blacklist size should be > 0")
	}
	if sizes.Whitelist == 0 {
		t.Error("whitelist size should be > 0")
	}
	if sizes.Graylist == 0 {
		t.Error("graylist size should be > 0")
	}
}
