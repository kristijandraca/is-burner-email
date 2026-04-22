/**
 * Aggregates disposable-email domain lists from upstream sources,
 * merges them, subtracts whitelist + graylist, and writes data/blacklist.json.
 *
 * Run with: npm run build:lists
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GRAYLIST } from '../data/graylist.js';
import { WHITELIST } from '../data/whitelist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const dataDir = resolve(rootDir, 'data');

interface Source {
  name: string;
  url: string;
  parse: (body: string) => string[];
}

const parseLines = (body: string): string[] =>
  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

const parseJsonArray = (body: string): string[] => {
  const parsed: unknown = JSON.parse(body);
  if (!Array.isArray(parsed)) throw new Error('expected JSON array');
  return parsed.filter((x): x is string => typeof x === 'string');
};

const SOURCES: Source[] = [
  {
    name: 'disposable-email-domains',
    url: 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf',
    parse: parseLines,
  },
  {
    name: 'ivolo',
    url: 'https://raw.githubusercontent.com/ivolo/disposable-email-domains/master/index.json',
    parse: parseJsonArray,
  },
  {
    name: 'FGRibreau/mailchecker',
    url: 'https://raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt',
    parse: parseLines,
  },
  {
    name: '7c/fakefilter',
    url: 'https://raw.githubusercontent.com/7c/fakefilter/main/txt/data.txt',
    parse: parseLines,
  },
  {
    name: 'martenson',
    url: 'https://raw.githubusercontent.com/martenson/disposable-email-domains/master/disposable_email_blocklist.conf',
    parse: parseLines,
  },
];

// Permissive domain regex: labels of letters/digits/hyphens, a dot, a TLD.
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function sanitizeDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase();
  if (!d) return null;
  if (!DOMAIN_RE.test(d)) return null;
  return d;
}

async function fetchSource(src: Source): Promise<string[]> {
  const res = await fetch(src.url, {
    headers: { 'user-agent': 'disposable-email-detector build-lists' },
  });
  if (!res.ok) {
    throw new Error(`fetch failed for ${src.name}: ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  const raw = src.parse(body);
  const cleaned: string[] = [];
  for (const entry of raw) {
    const d = sanitizeDomain(entry);
    if (d) cleaned.push(d);
  }
  return cleaned;
}

function readJsonArray(path: string): string[] {
  const body = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(body);
  if (!Array.isArray(parsed)) throw new Error(`${path} is not a JSON array`);
  return parsed.filter((x): x is string => typeof x === 'string');
}

function normalize(domains: readonly string[]): string[] {
  const cleaned: string[] = [];
  for (const d of domains) {
    const s = sanitizeDomain(d);
    if (s) cleaned.push(s);
  }
  return cleaned;
}

async function main(): Promise<void> {
  console.log(`Fetching ${SOURCES.length} sources...`);

  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  const merged = new Set<string>();
  let failures = 0;

  results.forEach((result, i) => {
    const source = SOURCES[i]!;
    if (result.status === 'fulfilled') {
      for (const d of result.value) merged.add(d);
      console.log(`  ✓ ${source.name.padEnd(32)} ${result.value.length} domains`);
    } else {
      failures++;
      console.error(`  ✗ ${source.name.padEnd(32)} ${result.reason}`);
    }
  });

  if (failures === SOURCES.length) {
    throw new Error('all sources failed');
  }

  const whitelist = new Set(normalize(WHITELIST));
  const graylist = new Set(normalize(GRAYLIST));

  // Whitelist always overrides. Graylist domains are managed separately
  // (anonymous-signup services that are only treated as disposable in strict mode),
  // so they should not appear in the blacklist.
  for (const d of whitelist) merged.delete(d);
  for (const d of graylist) merged.delete(d);

  const sorted = [...merged].sort();
  const outPath = resolve(dataDir, 'blacklist.json');

  const previous = readJsonArray(outPath);
  const added = sorted.filter((d) => !previous.includes(d)).length;
  const removed = previous.filter((d) => !sorted.includes(d)).length;

  writeFileSync(outPath, JSON.stringify(sorted, null, 0) + '\n');

  console.log(
    `\nWrote ${outPath}\n  total: ${sorted.length}\n  +${added} / -${removed} vs previous\n  failures: ${failures}/${SOURCES.length}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
