/**
 * Reads the canonical version from /VERSION and writes it into every
 * language package's version field:
 *   - packages/js/package.json
 *   - packages/py/pyproject.toml
 *   - packages/csharp/src/IsBurnerEmail/IsBurnerEmail.csproj
 *   - packages/csharp/cli/Burner.Cli/Burner.Cli.csproj
 *   - packages/kotlin/build.gradle.kts
 *
 * Also rewrites any hardcoded Maven coordinate `io.github.kristijandraca:
 * is-burner-email:X.Y.Z` in README.md and packages/kotlin/README.md — those
 * are the only places across all package READMEs where a version appears
 * in an install snippet (Gradle syntax requires it literal).
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

function updateCsprojVersion(relPath: string, version: string): boolean {
  const path = resolve(rootDir, relPath);
  const body = readFileSync(path, 'utf8');
  const pattern = /<Version>[^<]*<\/Version>/;
  if (!pattern.test(body)) {
    throw new Error(`Could not find <Version>...</Version> in ${path}`);
  }
  const next = body.replace(pattern, `<Version>${version}</Version>`);
  if (next === body) return false;
  writeFileSync(path, next);
  return true;
}

function updateKotlinBuildGradle(version: string): boolean {
  const path = resolve(rootDir, 'packages/kotlin/build.gradle.kts');
  const body = readFileSync(path, 'utf8');
  // Match the top-level `version = "X.Y.Z"` line inside the allprojects block.
  const pattern = /^(\s*version\s*=\s*)"[^"]*"/m;
  if (!pattern.test(body)) {
    throw new Error(`Could not find version = "..." line in ${path}`);
  }
  const next = body.replace(pattern, `$1"${version}"`);
  if (next === body) return false;
  writeFileSync(path, next);
  return true;
}

function updateMavenCoordinateInFile(relPath: string, version: string): boolean {
  const path = resolve(rootDir, relPath);
  const body = readFileSync(path, 'utf8');
  const pattern = /io\.github\.kristijandraca:is-burner-email:\d+\.\d+\.\d+/g;
  if (!pattern.test(body)) {
    throw new Error(`Could not find Maven coordinate string in ${path}`);
  }
  const next = body.replace(pattern, `io.github.kristijandraca:is-burner-email:${version}`);
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

  const csLibChanged = updateCsprojVersion('packages/csharp/src/IsBurnerEmail/IsBurnerEmail.csproj', version);
  console.error(`  ${csLibChanged ? '✓ updated' : '· unchanged'}  packages/csharp/src/IsBurnerEmail/IsBurnerEmail.csproj`);

  const csCliChanged = updateCsprojVersion('packages/csharp/cli/Burner.Cli/Burner.Cli.csproj', version);
  console.error(`  ${csCliChanged ? '✓ updated' : '· unchanged'}  packages/csharp/cli/Burner.Cli/Burner.Cli.csproj`);

  const ktChanged = updateKotlinBuildGradle(version);
  console.error(`  ${ktChanged ? '✓ updated' : '· unchanged'}  packages/kotlin/build.gradle.kts`);

  const rootReadmeChanged = updateMavenCoordinateInFile('README.md', version);
  console.error(`  ${rootReadmeChanged ? '✓ updated' : '· unchanged'}  README.md (Maven coord)`);

  const ktReadmeChanged = updateMavenCoordinateInFile('packages/kotlin/README.md', version);
  console.error(`  ${ktReadmeChanged ? '✓ updated' : '· unchanged'}  packages/kotlin/README.md (Maven coord)`);

  console.error('\nGo and PHP have no version files — their versions come from git tags.');
}

main();
