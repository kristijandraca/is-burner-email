/**
 * Aggregates disposable-email domain lists from upstream sources,
 * merges them with the manually-curated extra-blacklist, subtracts
 * whitelist + graylist, and writes data/blacklist.txt.
 *
 * Also syncs data/*.txt into language packages that need local copies
 * (Go for go:embed, PHP for runtime reads).
 *
 * Run with: npm run build:lists
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    name: 'tompec',
    url: 'https://raw.githubusercontent.com/tompec/disposable-email-domains/main/index.json',
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
    headers: { 'user-agent': 'is-burner-email build-lists' },
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

function readTxtSet(path: string): Set<string> {
  const body = readFileSync(path, 'utf8');
  const set = new Set<string>();
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const d = sanitizeDomain(t);
    if (d) set.add(d);
  }
  return set;
}

function readTxtList(path: string): string[] {
  const body = readFileSync(path, 'utf8');
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const d = sanitizeDomain(t);
    if (d) out.push(d);
  }
  return out;
}

// Packages that need a local copy of the data/ directory.
//   - Go: go:embed requires files under the package dir
//   - PHP: runtime reads use a package-relative path
//   - Python: editable installs need files under the source tree (wheels use
//     hatchling's force-include, which doesn't need this copy)
//   - C#: EmbeddedResource requires files under the csproj dir
//   - Kotlin: JVM classpath resources must live under src/main/resources
// The JS package reads root data/ directly via tsup's text loader.
const SYNC_TARGETS = [
  resolve(rootDir, 'packages/go/data'),
  resolve(rootDir, 'packages/php/data'),
  resolve(rootDir, 'packages/py/src/is_burner_email/data'),
  resolve(rootDir, 'packages/csharp/src/IsBurnerEmail/data'),
  resolve(rootDir, 'packages/kotlin/lib/src/main/resources'),
];

function syncDataDir(): void {
  const files = ['blacklist.txt', 'whitelist.txt', 'graylist.txt', 'extra-blacklist.txt'];
  for (const target of SYNC_TARGETS) {
    try {
      mkdirSync(target, { recursive: true });
      for (const f of files) {
        copyFileSync(resolve(dataDir, f), resolve(target, f));
      }
      console.log(`  ↳ synced to ${target.replace(rootDir + '/', '')}`);
    } catch (err) {
      // Targets may not exist yet if a package hasn't been created.
      console.log(`  ↳ skipped ${target.replace(rootDir + '/', '')} (${(err as Error).message})`);
    }
  }
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

  const extra = readTxtList(resolve(dataDir, 'extra-blacklist.txt'));
  for (const d of extra) merged.add(d);
  console.log(`  + ${'extra-blacklist'.padEnd(32)} ${extra.length} domains`);

  const whitelist = readTxtSet(resolve(dataDir, 'whitelist.txt'));
  const graylist = readTxtSet(resolve(dataDir, 'graylist.txt'));

  // Whitelist always overrides — even extra-blacklist entries. Graylist domains
  // live in the graylist, not the blacklist, so they're subtracted too.
  for (const d of whitelist) merged.delete(d);
  for (const d of graylist) merged.delete(d);

  const sorted = [...merged].sort();
  const outPath = resolve(dataDir, 'blacklist.txt');

  let previous: string[] = [];
  try {
    previous = readTxtList(outPath);
  } catch {
    // file may not exist yet on first run
  }
  const prevSet = new Set(previous);
  const currSet = new Set(sorted);
  const added = sorted.filter((d) => !prevSet.has(d)).length;
  const removed = previous.filter((d) => !currSet.has(d)).length;

  const header =
    '# Blacklist — AUTO-GENERATED by scripts/build-lists.ts. Do not edit.\n' +
    '# Source of truth for manual additions is data/extra-blacklist.txt.\n' +
    '\n';
  writeFileSync(outPath, header + sorted.join('\n') + '\n');

  console.log(
    `\nWrote ${outPath.replace(rootDir + '/', '')}\n  total: ${sorted.length}\n  +${added} / -${removed} vs previous\n  failures: ${failures}/${SOURCES.length}`,
  );

  console.log('\nSyncing data/ to language packages...');
  syncDataDir();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
