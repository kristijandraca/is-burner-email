/**
 * Aggregates disposable-email domain lists from upstream sources,
 * merges them with the manually-curated extra-blacklist, subtracts
 * whitelist + graylist, and writes data/blacklist.txt.
 *
 * Also syncs data/*.txt into language packages that need local copies
 * (Go for go:embed, PHP for runtime reads).
 *
 * When SUMMARY_DIR is set, writes refresh-summary.md and refresh-summary.json
 * into that directory for the refresh-lists workflow to slot into a PR body.
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
//   - Rust: include_str! embeds files relative to the crate dir
// The JS package reads root data/ directly via tsup's text loader.
const SYNC_TARGETS = [
  resolve(rootDir, 'packages/go/data'),
  resolve(rootDir, 'packages/php/data'),
  resolve(rootDir, 'packages/py/src/is_burner_email/data'),
  resolve(rootDir, 'packages/csharp/src/IsBurnerEmail/data'),
  resolve(rootDir, 'packages/kotlin/lib/src/main/resources'),
  resolve(rootDir, 'packages/rust/data'),
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

// A single run's stats. Populated by main(), consumed by emitSummary().
interface SourceResult {
  name: string;
  status: 'ok' | 'fail';
  count: number;
  error?: string;
}
interface RunStats {
  total: number;
  addedCount: number;
  removedCount: number;
  addedDomains: string[];
  removedDomains: string[];
  sources: SourceResult[];
  extraCount: number;
  failures: number;
  churnLevel: 'normal' | 'high';
}

// (added + removed) above this threshold flags the run as high-churn. Typical
// weekly refresh touches 10–100 domains; anything much above that warrants
// eyeballing upstream sources before merging the PR.
const HIGH_CHURN_THRESHOLD = 1000;

async function main(): Promise<void> {
  console.log(`Fetching ${SOURCES.length} sources...`);

  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  const merged = new Set<string>();
  const sources: SourceResult[] = [];
  let failures = 0;

  results.forEach((result, i) => {
    const source = SOURCES[i]!;
    if (result.status === 'fulfilled') {
      for (const d of result.value) merged.add(d);
      sources.push({ name: source.name, status: 'ok', count: result.value.length });
      console.log(`  ✓ ${source.name.padEnd(32)} ${result.value.length} domains`);
    } else {
      failures++;
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      sources.push({ name: source.name, status: 'fail', count: 0, error });
      console.error(`  ✗ ${source.name.padEnd(32)} ${error}`);
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
  const addedDomains = sorted.filter((d) => !prevSet.has(d));
  const removedDomains = previous.filter((d) => !currSet.has(d));

  const header =
    '# Blacklist — AUTO-GENERATED by scripts/build-lists.ts. Do not edit.\n' +
    '# Source of truth for manual additions is data/extra-blacklist.txt.\n' +
    '\n';
  writeFileSync(outPath, header + sorted.join('\n') + '\n');

  console.log(
    `\nWrote ${outPath.replace(rootDir + '/', '')}\n  total: ${sorted.length}\n  +${addedDomains.length} / -${removedDomains.length} vs previous\n  failures: ${failures}/${SOURCES.length}`,
  );

  console.log('\nSyncing data/ to language packages...');
  syncDataDir();

  const churn = addedDomains.length + removedDomains.length;
  const stats: RunStats = {
    total: sorted.length,
    addedCount: addedDomains.length,
    removedCount: removedDomains.length,
    addedDomains,
    removedDomains,
    sources,
    extraCount: extra.length,
    failures,
    churnLevel: churn > HIGH_CHURN_THRESHOLD ? 'high' : 'normal',
  };

  emitSummary(stats);
}

function formatList(domains: string[], cap: number): string {
  if (domains.length === 0) return '_none_';
  const shown = domains.slice(0, cap);
  const lines = shown.map((d) => `- \`${d}\``);
  if (domains.length > cap) {
    lines.push(`- _…and ${domains.length - cap} more — see the Files tab for the full diff._`);
  }
  return lines.join('\n');
}

function renderSummaryMarkdown(stats: RunStats): string {
  const churn = stats.addedCount + stats.removedCount;
  const churnBanner =
    stats.churnLevel === 'high'
      ? `> ⚠️ **HIGH CHURN** — ${churn.toLocaleString()} domains changed this run (threshold: ${HIGH_CHURN_THRESHOLD.toLocaleString()}).\n> Verify the per-source counts below look sane before merging; an anomaly here can indicate a compromised upstream.`
      : `✅ **Normal refresh.**`;

  const perSource = stats.sources
    .map((s) =>
      s.status === 'ok'
        ? `- ✓ \`${s.name}\` — ${s.count.toLocaleString()} domains`
        : `- ✗ \`${s.name}\` — **failed**: ${s.error ?? 'unknown error'}`,
    )
    .join('\n');

  const failureNote =
    stats.failures > 0
      ? `\n\n> ${stats.failures} of ${stats.sources.length} upstream sources failed this run. The merged list is still built from the sources that succeeded.`
      : '';

  return [
    '## Data refresh summary',
    '',
    `**Total blacklist:** ${stats.total.toLocaleString()} domains  `,
    `**This run:** +${stats.addedCount.toLocaleString()} / −${stats.removedCount.toLocaleString()}`,
    '',
    churnBanner,
    '',
    '### Per-source contribution',
    perSource,
    `- \\+ \`extra-blacklist\` — ${stats.extraCount.toLocaleString()} manual entries`,
    failureNote,
    '',
    `### Added (${stats.addedCount.toLocaleString()})`,
    formatList(stats.addedDomains, 100),
    '',
    `### Removed (${stats.removedCount.toLocaleString()})`,
    formatList(stats.removedDomains, 100),
    '',
    '---',
    '_Generated by `scripts/build-lists.ts`. Full diff is in the Files tab._',
    '',
  ].join('\n');
}

function emitSummary(stats: RunStats): void {
  const dir = process.env.SUMMARY_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const md = renderSummaryMarkdown(stats);
  writeFileSync(resolve(dir, 'refresh-summary.md'), md);
  writeFileSync(resolve(dir, 'refresh-summary.json'), JSON.stringify(stats, null, 2) + '\n');
  console.log(`\nWrote summary to ${dir.replace(rootDir + '/', '')}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
