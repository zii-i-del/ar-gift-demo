import assert from 'node:assert/strict';
import {
  Confetti,
  firstContact,
  local,
  world,
  coversMouth,
} from '../lib/confetti.ts';
import '../public/confetti-surfaces.js';
const frame = { x: 0, y: 0, scale: 100, angle: 0 };
const surface = (id = 'hair', y = 1) => ({
  id,
  frame: { ...frame },
  previous: { ...frame },
  segments: [[0, y, 6, y]],
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
});
const s = surface();
const contactStar={w:10,h:10,angle:0,flip:Math.PI,state:1};
const hit = firstContact({ x: 100, y: 0 }, { x: 100, y: 200 }, s, contactStar);
assert.ok(hit);
assert.equal(hit.t, 0.475);
assert.equal(hit.y, 0.95);
assert.equal(
  firstContact({ x: 100, y: 150 }, { x: 100, y: 170 }, s, contactStar),
  null,
  'no attraction from inside',
);
assert.equal(
  firstContact({ x: 100, y: 150 }, { x: 100, y: 0 }, s, contactStar),
  null,
  'upward crossing cannot attach',
);
assert.equal(
  firstContact({ x: 700, y: 0 }, { x: 700, y: 200 }, s, contactStar),
  null,
  'outside segment',
);
const moving = surface();
moving.previous.y = 50;
assert.ok(
  firstContact({ x: 100, y: 130 }, { x: 100, y: 130 }, moving, contactStar),
  'moving surface sweep',
);
for (const a of [0, 0.2, -0.4]) {
  const f = { x: 200, y: 100, scale: 120, angle: a },
    p = { x: 0.3, y: -0.4 },
    q = local(world(p, f), f);
  assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 1e-9);
}
const c = new Confetti();
c.modelReady = true;
assert.equal(c.trigger(1000), true);
assert.equal(c.trigger(1100), false);
assert.equal(c.armed, false);
c.count = 0;
c.surfaces.set('hair', surface());
c.surfaces.set('left', surface('left', 1.5));
c.spawn(0);
const p = c.particles[0],
  id = p.id;
p.x = 100;
p.y = 100 - p.h * 0.5 - 1;
p.vx = 0;
p.vy = 24000;
p.front = false;
c.step(1 / 60, 1017);
assert.equal(p.state, 2);
assert.equal(p.surface, 'hair');
assert.equal(p.id, id);
const originalX = p.x;
c.surfaces.get('hair').frame.x = 20;
c.step(1 / 60, 1034);
assert.ok(p.x > originalX + 19, 'crown landing follows head closely');
c.surfaces.get('hair').valid = false;
c.step(1 / 60, 1050);
assert.equal(p.fadeAt, -1);
c.step(1 / 60, 1360);
assert.equal(p.state, 2);
c.step(1 / 60, 8000);
assert.equal(c.active, 0);
assert.equal(c.playing, false);
assert.equal(c.armed, false, 'round end still requires release');
const c2 = new Confetti();
c2.modelReady = true;
c2.trigger(1000);
const pool = c2.particles;
for (let i = 0; i <= 420; i++) c2.step(1 / 60, 1000 + (i * 1000) / 60);
assert.equal(c2.emitted, 160);
assert.equal(c2.active, 0);
assert.equal(c2.particles, pool);
assert.equal(pool.length, 160);
const c3 = new Confetti();
c3.accept(
  {
    task: 'face',
    timestamp: 0,
    duration: 5,
    valid: true,
    faceLandmarks: Array(1404).fill(0.5),
  },
  1000,
);
assert.equal(c3.face, null, 'stale result ignored');
const data = new Uint8Array(128 * 128);
for (let y = 30; y < 60; y++)
  for (let x = 20; x < 100; x++) data[y * 128 + x] = 1;
data[10] = 1;
const g = globalThis.ConfettiSurfaces.component(
  { data, w: 128, h: 128 },
  [0.2, 0.2, 0.8, 0.6],
);
assert.equal(g.data[10], 0);
const lines = globalThis.ConfettiSurfaces.top(g, [0, 0, 1, 1], 96);
assert.ok(lines.length);
assert.ok(lines.flat().every((p) => p[1] === 30 / 128));
assert.equal(
  coversMouth(null, [], (x, y) => ({ x, y })),
  false,
);
console.log(
  'PASS confetti: swept first contact, no interior attraction, moving surface, local anchors, identity, fade/recycle, capacity, stale results, component/contour',
);
const face = Array(468 * 3).fill(0.5);
const fp = (i, x, y) => {
  face[i * 3] = x;
  face[i * 3 + 1] = y;
};
fp(234, 0.3, 0.45);
fp(454, 0.7, 0.45);
fp(13, 0.5, 0.58);
fp(14, 0.5, 0.6);
const hand = (x) => {
  const h = Array(63).fill(0);
  for (let i = 0; i < 21; i++) {
    h[i * 3] = x;
    h[i * 3 + 1] = 0.65;
  }
  h[1] = 0.85;
  for (const i of [8, 12, 16]) h[i * 3 + 1] = 0.5;
  return h;
};
const both = [hand(0.42), hand(0.58)],
  map = (x, y) => ({ x: x * 640, y: y * 480 });
assert.equal(coversMouth(face, both, map), true);
assert.equal(coversMouth(face, [both[0]], map), false);
assert.equal(
  coversMouth(face, [hand(0.5), hand(0.5)], map),
  false,
  'prayer pose',
);
const eyes = both.map((h) => h.map((v, i) => (i % 3 === 1 ? v - 0.3 : v)));
assert.equal(coversMouth(face, eyes, map), false, 'hands around eyes');
const trigger = new Confetti();
trigger.modelReady = true;
trigger.face = face;
trigger.hands = both;
for (let t = 1000; t <= 1300; t += 50) {
  trigger.faceTime = t;
  trigger.handsTime = t;
  trigger.gesture(t);
}
assert.equal(trigger.playing, true);
assert.equal(trigger.rounds, 1);
trigger.step(1 / 60, 8300);
for (let t = 8400; t < 9500; t += 50) {
  trigger.faceTime = t;
  trigger.handsTime = t;
  trigger.gesture(t);
}
assert.equal(trigger.rounds, 1, 'held pose cannot retrigger');
trigger.hands = [];
for (let t = 9500; t <= 9800; t += 50) {
  trigger.faceTime = t;
  trigger.handsTime = t;
  trigger.gesture(t);
}
assert.equal(trigger.armed, true);
const perf = new Confetti();
for (let t = 1000; t < 10000; t += 40) perf.update(40, t);
assert.equal(perf.count, 160, 'slow frames retain the fixed particle budget');
console.log(
  'PASS gesture positives/negatives, hold/release gate, sustained performance degradation',
);
// Cached anchors skip geometry until a new mask arrives, including pose-only movement.
const cached = new Confetti();
cached.started = 0;
cached.count = 0;
const cs = surface();
cached.surfaces.set('hair', cs);
const cp = cached.particles[0];
Object.assign(cp, {
  state: 2,
  surface: 'hair',
  ax: 1,
  ay: 0.95,
  w: 10,
  h: 10,
  fadeAt: -1,
});
cached.step(1 / 60, 1000);
const segments = cs.segments;
cs.segments = new Proxy(segments, {
  get(target, key) {
    if (key === Symbol.iterator) throw Error('unchanged mask scanned');
    return Reflect.get(target, key);
  },
});
cs.frame.x = 20;
cached.step(1 / 60, 1017);
assert.ok(Math.abs(cp.x - 120) < 1e-6, 'cached anchor still follows pose');
cs.segments = segments.map(([x, y, ex, ey]) => [x, y + 0.01, ex, ey + 0.01]);
cs.timestamp = 1034;
cached.step(1 / 60, 1034);
assert.equal(cp.ay, 0.95, 'new mask preserves established anchor');
cs.timestamp = 1050;
cs.segments = [[0, 2, 6, 2]];
cached.step(1 / 60, 1050);
assert.equal(cp.fadeAt, -1, 'large contour change preserves landing');
const stalls = new Confetti();
let steps = 0;
stalls.step = () => steps++;
for (let i = 0; i < 40; i++) stalls.update(750, 1000 + i * 750);
assert.equal(stalls.frameCount, 40);
assert.equal(stalls.longStalls, 40);
assert.equal(stalls.p95, 750);
assert.equal(stalls.report(31000).maxFrameMs, 750);
assert.ok(
  steps <= 120,
  'long stalls do not cause an unbounded physics backlog',
);
const thirty = new Confetti();
for (let i = 0; i < 400; i++) thirty.update(1000 / 30, 1000 + (i * 1000) / 30);
assert.equal(thirty.count, 160, '30 FPS retains the fixed particle budget');
const expired = new Confetti();
expired.started = 0;
expired.count = 0;
const es = surface();
expired.surfaces.set('hair', es);
Object.assign(expired.particles[0], {
  state: 1,
  x: 100,
  y: 94,
  w: 10,
  h: 10,
  vy: 200,
  front: false,
});
expired.step(1 / 60, 1251);
assert.equal(
  expired.particles[0].state,
  1,
  'stale masks cannot accept new particles',
);
console.log(
  'PASS cached anchors, new-mask corrections, jump rejection, long-stall accounting, bounded catch-up, 30 FPS threshold, strict freshness',
);

// Every receiving region retains identity through mask/pose loss until round end.
for (const region of ['hair', 'frontHair', 'left', 'right']) {
  const retained = new Confetti();
  retained.modelReady = true;
  retained.trigger(1000);
  retained.count = 0;
  const receiver = surface();
  receiver.id = region;
  receiver.poseTime = 1000;
  receiver.valid = false;
  receiver.segments = [];
  retained.surfaces.set(region, receiver);
  const landed = retained.particles[0];
  Object.assign(landed, {
    state: 2,
    surface: region,
    x: 100,
    y: 95,
    ax: 1,
    ay: 0.95,
    fadeAt: -1,
  });
  const particleId = landed.id;
  retained.step(1 / 60, 4000);
  assert.equal(landed.state, 2, region + ' survives prolonged tracking loss');
  assert.equal(landed.x, 100, region + ' holds last screen position');
  receiver.poseTime = 4100;
  receiver.frame.x = 20;
  retained.step(1 / 60, 4100);
  assert.equal(landed.x, 120, region + ' resumes local anchor following');
  retained.surfaces.delete(region);
  retained.step(1 / 60, 5000);
  assert.equal(landed.state, 2, region + ' survives absent surface');
  assert.equal(landed.id, particleId, region + ' retains original particle');
  retained.step(1 / 60, 7500);
  assert.equal(landed.alpha, 0.5, region + ' shares final round fade');
  retained.step(1 / 60, 8000);
  assert.equal(landed.state, 0, region + ' recycles at round end');
}
console.log(
  'PASS all regions retain landings through mask/pose loss, resume following and recycle at round end',
);

// Crown slots start over real top-facing hair; no extra particles are spawned.
const crownRound = new Confetti();
crownRound.modelReady = true;
crownRound.trigger(1000);
crownRound.count = 0;
const crownSurface = surface();
crownSurface.segments = [
  [2, 1, 4, 1],
  [4, 1, 4.1, 3],
];
crownRound.surfaces.set('hair', crownSurface);
crownRound.spawn(1, 1000);
const crownParticle = crownRound.particles[1],
  crownId = crownParticle.id;
assert.equal(crownParticle.crownOnly, true);
assert.ok(
  crownParticle.x !== 300 && Number.isFinite(crownParticle.vx),
  'dispersed origin has a planned initial velocity',
);
assert.ok(crownParticle.y < 0, 'particle still starts offscreen');
for (let t = 1017; t < 3500 && crownParticle.state === 1; t += 17) {
  crownSurface.timestamp = t;
  crownSurface.poseTime = t;
  crownRound.step(1 / 60, t);
}
assert.equal(crownParticle.state, 2, 'full falling trajectory reaches crown');
assert.equal(crownParticle.id, crownId);
assert.equal(crownRound.landed.hair, 1);
crownSurface.valid = false;
crownRound.spawn(11, 3500);
assert.equal(
  crownRound.particles[11].crownOnly,
  false,
  'no targeting invented for invalid crown',
);
crownSurface.valid = true;
crownSurface.timestamp = 1000;
crownRound.spawn(21, 3500);
assert.equal(
  crownRound.particles[21].crownOnly,
  false,
  'stale crown does not receive targeting',
);
console.log(
  'PASS crown emission uses observed top and preserves continuous contact and freshness',
);

const quick = new Confetti();
quick.modelReady = true;
quick.face = face;
quick.trigger(1000);
quick.count = 0;
quick.gesture(6400);
assert.equal(quick.phase, 'playing', 'early playback leaves hands off');
quick.hands = [];
for (const t of [6500, 6670, 6840]) {
  quick.faceTime = quick.handsTime = t;
  quick.gesture(t);
}
assert.equal(quick.phase, 'finishing');
assert.equal(quick.armed, true, 'release recorded before end');
quick.hands = both;
for (let t = 7010; t <= 7860; t += 170) {
  quick.faceTime = quick.handsTime = t;
  quick.gesture(t);
}
assert.equal(quick.rounds, 1, 'no overlap during end phase');
quick.step(1 / 60, 8000);
quick.faceTime = quick.handsTime = 8001;
quick.gesture(8001);
assert.equal(
  quick.rounds,
  2,
  'fresh held candidate starts next round without repeating release',
);
const staleRelease = new Confetti();
staleRelease.modelReady = true;
staleRelease.face = face;
staleRelease.trigger(1000);
staleRelease.count = 0;
staleRelease.hands = [];
staleRelease.faceTime = staleRelease.handsTime = 6500;
staleRelease.gesture(6500);
staleRelease.gesture(6900);
assert.equal(
  staleRelease.armed,
  false,
  'one stale empty observation cannot rearm',
);
console.log('PASS end-phase release memory, no overlap and no extra cooldown');
