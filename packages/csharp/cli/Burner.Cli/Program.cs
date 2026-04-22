using System;
using System.Text.Json;
using Kristijandraca.IsBurnerEmail;

const string HelpText = """
burner — burner / disposable email detection

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
""";

bool strict = false;
bool asJson = false;
bool stats = false;
bool help = false;
string? email = null;

foreach (var arg in args)
{
    switch (arg)
    {
        case "-h":
        case "--help":
            help = true;
            break;
        case "--strict":
            strict = true;
            break;
        case "--json":
            asJson = true;
            break;
        case "--stats":
            stats = true;
            break;
        default:
            if (email is null && !arg.StartsWith("-", StringComparison.Ordinal))
            {
                email = arg;
            }
            break;
    }
}

if (help)
{
    Console.Out.WriteLine(HelpText);
    return 0;
}

if (stats)
{
    var sizes = IsBurnerEmail.GetListSizes();
    if (asJson)
    {
        var payload = new { blacklist = sizes.Blacklist, whitelist = sizes.Whitelist, graylist = sizes.Graylist };
        Console.Out.WriteLine(JsonSerializer.Serialize(payload));
    }
    else
    {
        Console.Out.WriteLine($"blacklist: {sizes.Blacklist}\nwhitelist: {sizes.Whitelist}\ngraylist:  {sizes.Graylist}");
    }
    return 0;
}

if (email is null)
{
    Console.Error.WriteLine("Error: missing email argument");
    Console.Error.WriteLine();
    Console.Error.WriteLine(HelpText);
    return 2;
}

var mode = strict ? IsBurnerEmail.ModeStrict : IsBurnerEmail.ModeNormal;
var result = IsBurnerEmail.Check(email, mode);

if (result.Reason == "invalid-email")
{
    Console.Error.WriteLine($"Error: invalid email: {email}");
    return 2;
}

if (asJson)
{
    var payload = new
    {
        burner = result.Burner,
        domain = result.Domain,
        list = result.List,
        reason = result.Reason,
        mode,
    };
    Console.Out.WriteLine(JsonSerializer.Serialize(payload));
}
else
{
    var label = result.Burner ? "BURNER" : "OK";
    var listInfo = result.List is null ? string.Empty : $" ({result.List})";
    Console.Out.WriteLine($"{label}{listInfo}: {result.Domain} [{result.Reason}]");
}

return result.Burner ? 1 : 0;
