using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;

namespace Kristijandraca.IsBurnerEmail;

public static class IsBurnerEmail
{
    public const string ModeNormal = "normal";
    public const string ModeStrict = "strict";

    public const string ListBlacklist = "blacklist";
    public const string ListWhitelist = "whitelist";
    public const string ListGraylist = "graylist";

    private static readonly HashSet<string> Blacklist = LoadEmbedded("blacklist.txt");
    private static readonly HashSet<string> Whitelist = LoadEmbedded("whitelist.txt");
    private static readonly HashSet<string> Graylist = LoadEmbedded("graylist.txt");

    private static readonly HashSet<string> RuntimeBlacklist = new(StringComparer.Ordinal);
    private static readonly HashSet<string> RuntimeWhitelist = new(StringComparer.Ordinal);
    private static readonly object RuntimeLock = new();

    private static HashSet<string> LoadEmbedded(string name)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        var asm = typeof(IsBurnerEmail).GetTypeInfo().Assembly;
        using var stream = asm.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded resource '{name}' not found.");
        using var reader = new StreamReader(stream);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0 || trimmed[0] == '#') continue;
            set.Add(trimmed.ToLowerInvariant());
        }
        return set;
    }

    private static string Normalize(string value) => value.Trim().ToLowerInvariant();

    private static string? ExtractDomain(string? email)
    {
        if (email is null) return null;
        var trimmed = email.Trim();
        var at = trimmed.LastIndexOf('@');
        if (at <= 0 || at == trimmed.Length - 1) return null;
        var domain = trimmed.Substring(at + 1).ToLowerInvariant();
        if (domain.IndexOf('.') < 0) return null;
        return domain;
    }

    public static CheckResult Check(string? email, string mode = ModeNormal)
    {
        var domain = ExtractDomain(email);
        if (domain is null)
        {
            return new CheckResult(false, null, null, "invalid-email");
        }

        bool rWhite, rBlack;
        lock (RuntimeLock)
        {
            rWhite = RuntimeWhitelist.Contains(domain);
            rBlack = RuntimeBlacklist.Contains(domain);
        }

        if (rWhite || Whitelist.Contains(domain))
        {
            return new CheckResult(false, domain, ListWhitelist, "whitelisted");
        }

        if (rBlack || Blacklist.Contains(domain))
        {
            return new CheckResult(true, domain, ListBlacklist, "blacklisted");
        }

        if (Graylist.Contains(domain))
        {
            return mode == ModeStrict
                ? new CheckResult(true, domain, ListGraylist, "graylisted-strict")
                : new CheckResult(false, domain, ListGraylist, "graylisted-normal");
        }

        return new CheckResult(false, domain, null, "unknown");
    }

    public static bool IsBurner(string? email, string mode = ModeNormal)
        => Check(email, mode).Burner;

    public static void AddToBlacklist(string domain)
    {
        lock (RuntimeLock) RuntimeBlacklist.Add(Normalize(domain));
    }

    public static void AddToWhitelist(string domain)
    {
        lock (RuntimeLock) RuntimeWhitelist.Add(Normalize(domain));
    }

    public static bool RemoveFromBlacklist(string domain)
    {
        lock (RuntimeLock) return RuntimeBlacklist.Remove(Normalize(domain));
    }

    public static bool RemoveFromWhitelist(string domain)
    {
        lock (RuntimeLock) return RuntimeWhitelist.Remove(Normalize(domain));
    }

    public static ListSizes GetListSizes() => new(Blacklist.Count, Whitelist.Count, Graylist.Count);
}

public sealed class CheckResult
{
    public CheckResult(bool burner, string? domain, string? list, string reason)
    {
        Burner = burner;
        Domain = domain;
        List = list;
        Reason = reason;
    }

    public bool Burner { get; }
    public string? Domain { get; }
    public string? List { get; }
    public string Reason { get; }
}

public sealed class ListSizes
{
    public ListSizes(int blacklist, int whitelist, int graylist)
    {
        Blacklist = blacklist;
        Whitelist = whitelist;
        Graylist = graylist;
    }

    public int Blacklist { get; }
    public int Whitelist { get; }
    public int Graylist { get; }
}
