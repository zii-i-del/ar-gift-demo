import assert from 'node:assert/strict';
import { Confetti } from '../lib/confetti.ts';
import '../public/confetti-surfaces.js';
const c = new Confetti();
c.width = 640;
c.height = 480;
const frame = { x: 0, y: 0, scale: 640, angle: 0 };
const line = (a, b) => [
  [
    [a, 0.6],
    [b, 0.6],
  ],
];
// setSurface consumes raw camera coordinates and mirrors them into display space.
c.setSurface(
  'left',
  [
    [
      [0.1, 0.6],
      [0.15, 0.6],
      [0.2, 0.6],
      [0.25, 0.6],
      [0.3, 0.6],
    ],
  ],
  frame,
  1000,
);
const wide = c.surfaces.get('left').capacity;
c.setSurface('right', line(0.7, 0.73), frame, 1000);
assert.ok(wide > 2, 'visible wide shoulder allows more than two');
assert.ok(
  c.surfaces.get('right').capacity < wide,
  'narrow shoulder gets fewer',
);
c.setSurface('right', [], null, 1000);
assert.equal(c.surfaces.get('right').valid, false);
c.modelReady = true;
c.trigger(1000);
c.count = 0;
c.spawn(1, 1000);
assert.equal(
  c.particles[1].shoulderOnly,
  true,
  'missing hair target can use shoulders',
);
assert.ok(
  c.particles[1].y < 0,
  'redistribution happens at emission, not teleport at contact',
);
// A real swept crossing remains mandatory, with spacing and aggregate limits.
const s = c.surfaces.get('left');
s.frame = { x: 0, y: 0, scale: 100, angle: 0 };
s.previous = s.frame;
s.segments = [[0, 1, 6, 1]];
s.capacity = 12;
for (let i = 0; i < 15; i++) {
  const p = c.particles[i];
  Object.assign(p, {
    state: 1,
    interior: false,
    shoulderOnly: true,
    front: false,
    x: 20 + i * 30,
    y: 96,
    vy: 200,
    vx: 0,
    w: 5,
    h: 5,
    fadeAt: -1,
  });
  c.step(1 / 60, 1000 + i);
}
assert.equal(c.landed.left, 6, 'single shoulder is bounded to six');
assert.equal(c.particles[14].state, 1, 'excess continues falling');
const grid = (filled) => ({
  width: 128,
  height: 128,
  getAsFloat32Array: () =>
    Float32Array.from(
      { length: 16384 },
      (_, i) => +filled(i % 128, Math.floor(i / 128)),
    ),
});
const face = Array(1404).fill(0.5);
for (const [i, x, y] of [
  [234, 0.3, 0.4],
  [454, 0.7, 0.4],
  [10, 0.5, 0.25],
  [152, 0.5, 0.65],
]) {
  face[i * 3] = x;
  face[i * 3 + 1] = y;
}
const pose = Array.from({ length: 33 }, () => ({
  x: 0.5,
  y: 0.9,
  visibility: 1,
}));
pose[11] = { x: 0.3, y: 0.6, visibility: 1 };
pose[12] = { x: 0.7, y: 0.6, visibility: 1 };
const person = grid((x, y) => x > 10 && x < 118 && y >= 75);
const api = globalThis.ConfettiSurfaces;
api.hair(
  grid(() => false),
  face,
  true,
  1000,
);
const exposed = api.shoulders(person, pose, 1000);
assert.ok(
  exposed.left.length && exposed.right.length,
  'fresh empty hair mask permits exposed shoulders',
);
api.hair(
  grid((x, y) => x > 10 && x < 118 && y > 5),
  face,
  true,
  1100,
);
assert.equal(
  api.shoulders(person, pose, 1100).left.length,
  0,
  'hair-covered shoulder filtered',
);
assert.equal(
  api.shoulders(person, pose, 1400).right.length,
  0,
  'stale mask does not invent exposed shoulder',
);
console.log(
  'PASS adaptive shoulder capacity, missing-target routing, trajectory, 12 total cap, hair occlusion and freshness',
);
const budget = new Confetti();
budget.modelReady = true;
budget.trigger(1000);
budget.count = 0;
budget.surfaces.set('left', { ...s, capacity: 12 });
budget.roundContacts = 32;
Object.assign(budget.particles[0], {
  state: 1,
  front: false,
  x: 20,
  y: 96,
  vy: 200,
  w: 5,
  h: 5,
});
budget.step(1 / 60, 1000);
assert.equal(budget.particles[0].state, 1, 'global contact budget is enforced');
const samples = [],
  points = Array.from({ length: 32 }, (_, i) => [0.1 + i * 0.006, 0.6]);
for (let i = 0; i < 2200; i++) {
  const start = performance.now();
  c.setSurface('left', [points], frame, 2000 + i);
  if (i >= 200) samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  `Shoulder surface update including capacity: P95 ${samples[1900].toFixed(4)} ms; Node synthetic, excludes inference/rendering`,
);
const { shoulderTops } = globalThis.ConfettiSurfaces;
const flat = Array.from({ length: 12 }, (_, i) => [i * 0.01, 0.5]);
assert.ok(
  shoulderTops([flat], 128, 128).length,
  'flat shoulder top remains available',
);
const steep = Array.from({ length: 12 }, (_, i) => [i * 0.01, 0.4 + i * 0.015]);
assert.equal(
  shoulderTops([steep], 128, 128).length,
  0,
  'descending arm edge rejected',
);
const stairs = Array.from({ length: 20 }, (_, i) => [
  i / 128,
  0.4 + (Math.floor(i / 2) * 2) / 128,
]);
assert.equal(
  shoulderTops([stairs], 128, 128).length,
  0,
  'pixel stair plateaus do not become shelves',
);
assert.equal(
  shoulderTops([steep.map(([x, y]) => [1 - x, y]).reverse()], 128, 128).length,
  0,
  'opposite shoulder slope also rejected',
);
const narrowAspect = Array.from({ length: 12 }, (_, i) => [
  i * 0.01,
  0.4 + i * 0.008,
]);
assert.ok(
  shoulderTops([narrowAspect], 256, 128).length,
  'slope uses pixel aspect',
);
const reject = new Confetti();
reject.setSurface(
  'left',
  [
    [
      [0.1, 0.4],
      [0.15, 0.5],
      [0.2, 0.6],
    ],
  ],
  frame,
  1000,
);
assert.equal(
  reject.surfaces.get('left').valid,
  false,
  'controller also rejects steep shoulder geometry',
);
assert.equal(
  reject.surfaces.get('left').capacity,
  0,
  'rejected sides add no capacity',
);
console.log(
  'PASS shoulder top slope, staircase rejection, mirror/aspect correctness and capacity exclusion',
);
// Regression for the actual failure: shallow quantized edges were fragmented twice.
const shallow = Array.from({ length: 20 }, (_, i) => [
  (40 + i) / 128,
  (50 + Math.floor(i / 3)) / 128,
]);
const fitted = shoulderTops([shallow], 128, 128);
const smooth = new Confetti();
smooth.resize(128, 128, 128, 128);
smooth.setSurface('left', fitted, { x: 0, y: 0, scale: 128, angle: 0 }, 1000);
assert.ok(
  smooth.surfaces.get('left').segments.length >= 17,
  'shallow shoulder stays continuous through both stages',
);
const split = shoulderTops([flat.slice(0, 5), flat.slice(7)], 128, 128);
assert.equal(split.length, 2, 'fit never bridges missing/occluded runs');
const raw = Float32Array.from({ length: 256 * 256 }, (_, i) =>
  Math.floor(i / 256) >= 150 ? 1 : 0,
);
let reads = 0;
const nativeMask = {
  width: 256,
  height: 256,
  getAsFloat32Array() {
    reads++;
    return raw;
  },
};
api.hair(
  grid(() => false),
  face,
  true,
  2000,
);
const roiTimes = [];
for (let i = 0; i < 1200; i++) {
  const t = performance.now();
  api.shoulders(nativeMask, pose, 2000);
  if (i >= 200) roiTimes.push(performance.now() - t);
}
assert.equal(reads, 1200, 'only one body mask readback per update');
assert.ok(
  api.shoulderStats.leftRaw <= 24 && api.shoulderStats.rightRaw <= 24,
  'bounded ROI samples',
);
roiTimes.sort((a, b) => a - b);
console.log(
  `PASS shallow-curve regression, gap preservation, single readback and 24-point limits; both shoulders processing P95 ${roiTimes[950].toFixed(4)} ms (synthetic CPU only)`,
);
// A square model mask is NOT evidence of a square camera image.
const normalizedSlope = Array.from({ length: 20 }, (_, i) => [
  0.2 + i * 0.008,
  0.3 + i * 0.008 * 0.8,
]);
assert.equal(shoulderTops([normalizedSlope], 256, 256).length, 0);
assert.ok(
  shoulderTops([normalizedSlope], 1280, 720, (2 * 720) / 256).length,
  'landscape camera restores actual shallow slope',
);
const boundaryData = Float32Array.from({ length: 128 * 128 }, (_, i) =>
  Math.floor(i / 128) >= 55 ? 1 : 0,
);
assert.equal(
  api.localTop(boundaryData, 128, 128, [0.2, 0.5, 0.4, 0.7]).length,
  0,
  'old ROI starts inside person',
);
const recovered = api.localTop(
  boundaryData,
  128,
  128,
  [0.2, 0.5, 0.4, 0.7],
  24,
  0.15,
);
assert.ok(
  recovered.length && recovered.flat().every((p) => p[1] === 55 / 128),
  'bounded upward search recovers true top',
);
assert.equal(
  api.localTop(
    new Float32Array(128 * 128).fill(1),
    128,
    128,
    [0.2, 0.5, 0.4, 0.7],
    24,
    0.15,
  ).length,
  0,
  'no invented edge in solid foreground',
);
api.hair(
  grid(() => false),
  face,
  true,
  2000,
);
api.shoulders(nativeMask, pose, 2000, { width: 1280, height: 720 });
assert.equal(
  api.shoulderStats.imageAspect,
  1280 / 720,
  'source aspect reaches actual shoulder path',
);
console.log(
  'PASS square-mask/landscape-video mismatch and bounded real-boundary recovery',
);
// Brief loss must not irrevocably erase a valid landing; stale masks still cannot catch.
const transient = new Confetti();
transient.modelReady = true;
transient.trigger(1000);
transient.count = 0;
const ts = {
  id: 'left',
  frame: { x: 0, y: 0, scale: 100, angle: 0 },
  previous: { x: 0, y: 0, scale: 100, angle: 0 },
  segments: [[0, 1, 6, 1]],
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
  capacity: 6,
};
transient.surfaces.set('left', ts);
const held = transient.particles[0];
Object.assign(held, {
  state: 2,
  surface: 'left',
  ax: 1,
  ay: 0.975,
  w: 5,
  h: 5,
  fadeAt: -1,
  anchorRevision: 1000,
});
ts.valid = false;
ts.poseTime = 1100;
transient.step(1 / 60, 1100);
assert.equal(held.fadeAt, -1, 'one missing result does not erase landing');
ts.valid = true;
ts.timestamp = 1200;
ts.poseTime = 1200;
transient.step(1 / 60, 1200);
assert.equal(
  held.fadeAt,
  -1,
  'fresh contour recovers without reappearing particles',
);
ts.valid = false;
ts.poseTime = 1451;
transient.step(1 / 60, 1451);
assert.equal(
  held.fadeAt,
  -1,
  'missing mask retains landing with reliable pose',
);
ts.poseTime = 4000;
ts.frame.x = 20;
transient.step(1 / 60, 4000);
assert.equal(held.fadeAt, -1, 'multiple seconds without mask retain landing');
assert.equal(held.x, 120, 'retained anchor follows shoulder pose');
ts.valid = true;
ts.timestamp = 4100;
ts.poseTime = 4100;
ts.segments = [[0, 4, 6, 4]];
transient.step(1 / 60, 4100);
assert.equal(
  held.fadeAt,
  -1,
  'changed contour does not erase established anchor',
);
assert.equal(held.y, 97.5, 'changed contour does not teleport landing');
transient.step(1 / 60, 4351);
assert.equal(held.fadeAt, -1, 'lost pose preserves last position');
assert.equal(transient.shoulderLosses, 0);
// Round lifetime stays bounded even when the mask never recovers.
const roundHeld = transient.particles[1];
Object.assign(roundHeld, {
  state: 2,
  surface: 'left',
  ax: 1,
  ay: 1,
  fadeAt: -1,
});
ts.valid = false;
ts.poseTime = 8001;
transient.step(1 / 60, 8001);
assert.equal(roundHeld.state, 0, 'round end recycles retained landing');
// Fresh hair no longer consumes every targeted emission opportunity.
const allocated = new Confetti();
allocated.modelReady = true;
allocated.trigger(1000);
allocated.surfaces.set('left', {
  ...ts,
  valid: true,
  timestamp: 1000,
  poseTime: 1000,
});
allocated.surfaces.set('frontHair', {
  ...ts,
  id: 'frontHair',
  valid: true,
  timestamp: 1000,
  poseTime: 1000,
  patchIds: [1, 2, 3],
  patchIndex: new Map([
    [1, 0],
    [2, 0],
    [3, 0],
  ]),
});
allocated.spawn(1, 1000);
assert.equal(allocated.particles[1].aimedShoulder, 'left');
assert.equal(allocated.shoulderLaunches.left, 1);
console.log(
  'PASS bounded shoulder loss recovery and explicit emission allocation',
);
