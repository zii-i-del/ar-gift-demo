import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Existing independent assertion scripts; no test-framework dependency.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(new URL('./', import.meta.url))
  .filter(name => name.endsWith('.mjs') && name !== 'run.mjs' && !name.endsWith('-performance.mjs'))
  .sort();
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', `tests/${file}`], {
    cwd: root, encoding: 'utf8', timeout: 60000,
  });
  if (result.status === 0) console.log(`PASS ${file}`);
  else {
    failed++;
    console.error(`FAIL ${file}\n${result.stdout}${result.stderr}${result.error ?? ''}`);
  }
}
console.log(`${files.length - failed}/${files.length} scripts passed. CPU benchmarks run separately; see tests/EFFECT-BASELINE.md.`);
process.exitCode = failed ? 1 : 0;
