#!/usr/bin/env node
import { check, getListSizes, type Mode } from './index.js';

const HELP = `burner — burner / disposable email detection

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
`;

function parseArgs(argv: string[]): {
  help: boolean;
  stats: boolean;
  strict: boolean;
  json: boolean;
  email: string | undefined;
} {
  let help = false;
  let stats = false;
  let strict = false;
  let json = false;
  let email: string | undefined;

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') help = true;
    else if (arg === '--stats') stats = true;
    else if (arg === '--strict') strict = true;
    else if (arg === '--json') json = true;
    else if (!arg.startsWith('-')) email = arg;
  }

  return { help, stats, strict, json, email };
}

function main(): number {
  const { help, stats, strict, json, email } = parseArgs(process.argv.slice(2));

  if (help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (stats) {
    const sizes = getListSizes();
    if (json) {
      process.stdout.write(JSON.stringify(sizes) + '\n');
    } else {
      process.stdout.write(
        `blacklist: ${sizes.blacklist}\nwhitelist: ${sizes.whitelist}\ngraylist:  ${sizes.graylist}\n`,
      );
    }
    return 0;
  }

  if (!email) {
    process.stderr.write('Error: missing email argument\n\n');
    process.stderr.write(HELP);
    return 2;
  }

  const mode: Mode = strict ? 'strict' : 'normal';
  const result = check(email, { mode });

  if (result.reason === 'invalid-email') {
    process.stderr.write(`Error: invalid email: ${email}\n`);
    return 2;
  }

  if (json) {
    process.stdout.write(JSON.stringify({ ...result, mode }) + '\n');
  } else {
    const label = result.burner ? 'BURNER' : 'OK';
    const listInfo = result.list ? ` (${result.list})` : '';
    process.stdout.write(`${label}${listInfo}: ${result.domain} [${result.reason}]\n`);
  }

  return result.burner ? 1 : 0;
}

process.exit(main());
