import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayEffects } from './helpers/effect-replay.mjs';

const expected = JSON.parse(readFileSync(new URL('./fixtures/effect-baseline.json', import.meta.url)));
const actual = replayEffects();
assert.deepEqual(actual, expected.effects, 'approved baseline changed; inspect the behavior, do not automatically rewrite the fixture');
assert.deepEqual(replayEffects(), actual, 'fixed inputs must be reproducible');
for (const orientation of ['landscape', 'portrait']) {
  const stars = actual[orientation].stars;
  assert.equal(stars.count, orientation === 'landscape' ? 160 : 100);
  assert.equal(stars.snapshots.at(-1).active, 0, 'round ends with no particles');
  for (const [region, trace] of Object.entries(actual[orientation].contacts)) {
    assert.equal(trace.at(-1)[1], 2, `${orientation} ${region} must really receive a star`);
    assert.equal(trace.at(-1)[2], region);
    assert(trace.every(row => row[0] === trace[0][0]), 'contact retains particle identity');
  }
}
console.log('PASS deterministic landscape/portrait emission times, sizes, trajectories, mapping and four contact regions (CPU simulation only)');
