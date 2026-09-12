import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Confetti } from '../lib/confetti.ts';
import '../public/confetti-surfaces.js';
const f = Array(1404).fill(0.5);
for (const [i, x, y] of [
  [234, 0.3, 0.4],
  [454, 0.7, 0.4],
  [10, 0.5, 0.25],
  [152, 0.5, 0.7],
]) {
  f[i * 3] = x;
  f[i * 3 + 1] = y;
}
const grid = (fn) => ({
  w: 128,
  h: 128,
  data: Uint8Array.from(
    { length: 16384 },
    (_, i) => +fn((i % 128) / 128, Math.floor(i / 128) / 128),
  ),
});
const { patches } = globalThis.ConfettiSurfaces;
assert.equal(
  patches(
    grid(() => false),
    f,
  ).length,
  0,
  'no hair means no points',
);
const short = grid((x, y) => x > 0.2 && x < 0.8 && y > 0.08 && y < 0.21);
const sp = patches(short, f);
assert.ok(sp.length > 0);
assert.ok(
  sp.every((p) => p.line[0][1] < 0.21),
  'short hair creates no invented long hair or fringe',
);
const bare = grid(
  (x, y) =>
    x > 0.17 &&
    x < 0.83 &&
    y > 0.08 &&
    y < 0.95 &&
    !(x > 0.3 && x < 0.7 && y > 0.25),
);
assert.ok(
  patches(bare, f).every((p) => p.region !== 'fringe'),
  'bare forehead has no fringe candidate',
);
const fringe = grid(
  (x, y) =>
    x > 0.17 &&
    x < 0.83 &&
    y > 0.08 &&
    y < 0.95 &&
    !(x > 0.3 && x < 0.7 && y > 0.43),
);
assert.ok(
  patches(fringe, f).some((p) => p.region === 'fringe'),
  'actual forehead hair creates fringe candidates',
);
assert.ok(patches(fringe, f).length <= 22);
const c = new Confetti();
const packet = (t) => ({
  task: 'hair',
  timestamp: t,
  duration: 10,
  valid: true,
  faceLandmarks: f,
  lines: [
    [
      [0.2, 0.15],
      [0.25, 0.15],
    ],
  ],
  patches: [
    {
      id: 7,
      line: [
        [0.22, 0.4],
        [0.25, 0.4],
      ],
      region: 'side',
    },
  ],
});
c.accept(packet(1000), 1000);
assert.ok(
  !c.surfaces.get('frontHair')?.valid,
  'one mask does not create stable candidates',
);
c.accept(packet(1100), 1100);
assert.equal(c.surfaces.get('frontHair').valid, true);
c.trigger(1100, 20);
c.count = 0;
const s = c.surfaces.get('frontHair'),
  line = s.segments[0];
const { world } = await import('../lib/confetti.ts');
const target = world({ x: (line[0] + line[2]) / 2, y: line[1] }, s.frame);
const p = c.particles[0];
Object.assign(p, {
  state: 1,
  interior: true,
  patchId: 7,
  front: false,
  x: target.x,
  y: target.y - 4,
  vy: 200,
  w: 4,
  h: 4,
});
c.step(1 / 60, 1117);
assert.equal(p.state, 2, 'falling particle touches actual interior patch');
assert.equal(p.surface, 'frontHair');
assert.equal(p.id, 0);
assert.ok(c.usedPatches.has(7));
const q = c.particles[1];
Object.assign(q, {
  state: 1,
  interior: true,
  patchId: 7,
  front: false,
  x: target.x,
  y: target.y - 4,
  vy: 200,
  w: 4,
  h: 4,
});
c.step(1 / 60, 1134);
assert.equal(q.state, 1, 'occupied patch cannot stack');
c.accept({ ...packet(1150), patches: [] }, 1150);
c.step(1 / 60, 1150);
assert.equal(
  p.fadeAt,
  -1,
  'occluded or missing hair preserves attached particle',
);
c.reset();
c.trigger(1200);
assert.equal(
  c.frontHairEnabled,
  true,
  'ordinary gesture rounds use the same interior contact rules',
);
const times = [];
for (let i = 0; i < 2200; i++) {
  const t = performance.now();
  patches(fringe, f);
  if (i >= 200) times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
console.log(
  `PASS front hair: empty/short/bare/fringe masks, two-result stability, trajectory identity, occupancy, disappearance, rollout gate; extraction P95 ${times[1900].toFixed(4)} ms (synthetic CPU only)`,
);
const capped = new Confetti();
capped.modelReady = true;
capped.trigger(1000);
capped.count = 0;
const frame = { x: 0, y: 0, scale: 100, angle: 0 };
capped.surfaces.set('hair', {
  id: 'hair',
  frame,
  previous: frame,
  segments: [[0, 1, 6, 1]],
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
});
for (let i = 0; i < 8; i++) {
  Object.assign(capped.particles[i], {
    state: 1,
    interior: false,
    front: false,
    x: 100 + i * 10,
    y: 96,
    vy: 200,
    vx: 0,
    w: 5,
    h: 5,
    fadeAt: -1,
  });
  capped.step(1 / 60, 1000 + i);
}
assert.equal(
  capped.landed.hair,
  3,
  'ordinary rounds enforce three crown contacts',
);
assert.equal(
  capped.particles[7].state,
  1,
  'excess crown particle keeps falling',
);
console.log('PASS ordinary trigger crown cap');

// Symmetric targets both receive attempts even with only a few visible patches.
const coverage = new Confetti();
coverage.modelReady = true;
coverage.trigger(1000);
coverage.count = 0;
const targetSurface = {
  id: 'frontHair',
  frame: { x: 0, y: 0, scale: 100, angle: 0 },
  previous: { x: 0, y: 0, scale: 100, angle: 0 },
  segments: [
    [0.9, 3, 1.1, 3],
    [4.9, 3, 5.1, 3],
  ],
  patchIds: [10, 20],
  patchIndex: new Map([
    [10, 0],
    [20, 1],
  ]),
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
};
coverage.surfaces.set('frontHair', targetSurface);
coverage.spawn(1, 1000);
coverage.spawn(3, 1000);
assert.deepEqual(
  [coverage.particles[1].patchId, coverage.particles[3].patchId],
  [10, 20],
  'both sides get a first attempt before repeats',
);
const airborne = coverage.particles[3];
Object.assign(airborne, { x: 500, y: 250, w: 4, h: 4, vy: 50, vx: 0 });
targetSurface.valid = false;
targetSurface.patchIndex = new Map();
coverage.step(1 / 60, 1100);
assert.equal(
  airborne.interior,
  true,
  'missing patch cannot permanently revoke airborne hair eligibility',
);
assert.equal(airborne.state, 1, 'invalid target cannot receive new landing');
targetSurface.valid = true;
targetSurface.patchIndex = new Map([
  [10, 0],
  [20, 1],
]);
coverage.step(1 / 60, 1400);
assert.equal(airborne.interior, true, 'stale mask keeps target identity');
assert.equal(airborne.state, 1, 'stale target still cannot catch');
targetSurface.timestamp = 1417;
targetSurface.poseTime = 1417;
Object.assign(airborne, { x: 500, y: 296, vy: 200, vx: 0 });
coverage.step(1 / 60, 1417);
assert.equal(
  airborne.state,
  2,
  'right target recovers and receives original falling particle',
);
assert.equal(airborne.patchId, 20);
console.log(
  'PASS fair hair emission and recovery of airborne targets without stale contact',
);

const scattered = patches(
  grid((x, y) => x > 0.15 && x < 0.85 && y > 0.05 && y < 0.95),
  f,
);
assert.deepEqual(
  scattered,
  patches(
    grid((x, y) => x > 0.15 && x < 0.85 && y > 0.05 && y < 0.95),
    f,
  ),
  'irregular candidate IDs and coordinates are stable',
);
assert.ok(scattered.length <= 22);
assert.ok(
  new Set(scattered.map((p) => p.line[0][0].toFixed(4))).size >=
    Math.min(10, scattered.length),
  'candidate positions do not reuse fixed columns',
);
for (let i = 0; i < scattered.length; i++)
  for (let j = 0; j < i; j++) {
    const a = scattered[i].line,
      b = scattered[j].line;
    assert.ok(
      Math.hypot(
        (a[0][0] + a[1][0] - b[0][0] - b[1][0]) / 2,
        a[0][1] - b[0][1],
      ) >=
        0.4 * 0.13 - 1e-6,
      'minimum spatial separation',
    );
  }
console.log('PASS stable irregular candidates, cap and spacing');
