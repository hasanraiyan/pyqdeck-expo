// CI guard: fail the build if the merged release manifest requests a
// forbidden permission (see manifestPermissions.mjs for why).
//
//   node scripts/check-manifest-permissions.mjs            # after a release build
//   node scripts/check-manifest-permissions.mjs <dir> ...  # check these dirs instead
//
// It fails when it finds NO manifest to check, so a changed build layout can
// never turn this into a check that passes by looking at nothing.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { forbiddenPermissions } from './manifestPermissions.mjs';

const DEFAULT_DIRS = [
  'android/app/build/intermediates/merged_manifests/release',
  'android/app/build/intermediates/packaged_manifests/release',
];

function manifestsUnder(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...manifestsUnder(full));
    else if (entry.name === 'AndroidManifest.xml') out.push(full);
  }
  return out;
}

const dirs = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_DIRS;
const files = dirs.flatMap(manifestsUnder);

if (files.length === 0) {
  console.error(`No AndroidManifest.xml found under:\n  ${dirs.join('\n  ')}`);
  console.error('Refusing to pass without checking anything. Did the build layout change?');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const bad = forbiddenPermissions(readFileSync(file, 'utf8'));
  const label = relative(process.cwd(), file);
  if (bad.length > 0) {
    failed = true;
    console.error(`FORBIDDEN permission(s) in ${label}:`);
    for (const p of bad) console.error(`  - ${p}`);
  } else {
    console.log(`ok  ${label}`);
  }
}

if (failed) {
  console.error(
    '\nGoogle Play requires a declaration for these. Find which library adds them ' +
      '(search node_modules for the permission name) and block them with ' +
      'expo.android.blockedPermissions in app.json.'
  );
  process.exit(1);
}
console.log(`Checked ${files.length} manifest(s): no forbidden permissions.`);
