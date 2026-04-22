/**
 * Bumps the canonical version in /VERSION, then syncs it into every language
 * package. Prints the new version to stdout (so shell pipelines can capture it).
 *
 * Usage:
 *   npx tsx scripts/bump-version.ts <patch|minor|major>
 *
 * Exits non-zero if the bump type is invalid or VERSION is unparseable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const bumpType = process.argv[2];
if (bumpType !== 'patch' && bumpType !== 'minor' && bumpType !== 'major') {
  console.error(`Usage: tsx scripts/bump-version.ts <patch|minor|major>`);
  console.error(`Got: ${JSON.stringify(bumpType)}`);
  process.exit(2);
}

function readVersion(): [number, number, number] {
  const v = readFileSync(resolve(rootDir, 'VERSION'), 'utf8').trim();
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!match) throw new Error(`VERSION is not a valid semver: ${JSON.stringify(v)}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function writeVersion(next: string): void {
  writeFileSync(resolve(rootDir, 'VERSION'), next + '\n');
}

async function runSync(): Promise<void> {
  // Import dynamically so the bump script owns the one side-effect execution order.
  await import('./sync-version.js');
}

async function main(): Promise<void> {
  const [maj, min, patch] = readVersion();
  let next: string;
  switch (bumpType) {
    case 'major':
      next = `${maj + 1}.0.0`;
      break;
    case 'minor':
      next = `${maj}.${min + 1}.0`;
      break;
    case 'patch':
      next = `${maj}.${min}.${patch + 1}`;
      break;
  }

  console.error(`Bumping ${maj}.${min}.${patch} → ${next} (${bumpType})`);
  writeVersion(next);

  await runSync();

  // Print the new version to stdout last, so callers can capture it cleanly
  // (e.g. GitHub Actions step outputs).
  process.stdout.write(next);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
