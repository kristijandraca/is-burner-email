/**
 * Reads the canonical version from /VERSION and writes it into every
 * language package's version field:
 *   - packages/js/package.json
 *   - packages/py/pyproject.toml
 *
 * Go and PHP have no version file — their versions come from git tags.
 *
 * Run with: npx tsx scripts/sync-version.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readVersion(): string {
  const v = readFileSync(resolve(rootDir, 'VERSION'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    throw new Error(`VERSION file does not contain a valid semver: ${JSON.stringify(v)}`);
  }
  return v;
}

function updateJsPackageJson(version: string): boolean {
  const path = resolve(rootDir, 'packages/js/package.json');
  const body = readFileSync(path, 'utf8');
  const pkg = JSON.parse(body) as { version?: string };
  if (pkg.version === version) return false;
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  return true;
}

function updatePyPyproject(version: string): boolean {
  const path = resolve(rootDir, 'packages/py/pyproject.toml');
  const body = readFileSync(path, 'utf8');
  // Match the top-level `version = "X.Y.Z"` under [project].
  const pattern = /^(version\s*=\s*)"[^"]*"/m;
  if (!pattern.test(body)) {
    throw new Error(`Could not find version = "..." line in ${path}`);
  }
  const next = body.replace(pattern, `$1"${version}"`);
  if (next === body) return false;
  writeFileSync(path, next);
  return true;
}

function main(): void {
  const version = readVersion();
  console.error(`Syncing version ${version} into language packages...`);

  const jsChanged = updateJsPackageJson(version);
  console.error(`  ${jsChanged ? '✓ updated' : '· unchanged'}  packages/js/package.json`);

  const pyChanged = updatePyPyproject(version);
  console.error(`  ${pyChanged ? '✓ updated' : '· unchanged'}  packages/py/pyproject.toml`);

  console.error('\nGo and PHP have no version files — their versions come from git tags.');
}

main();
