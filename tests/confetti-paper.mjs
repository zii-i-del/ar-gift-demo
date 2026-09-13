import assert from 'node:assert/strict';
import { Confetti, paperSupport } from '../lib/confetti.ts';
const p = { w: 20, h: 10, angle: 0, flip: 0 };
const down = 5 * Math.cos(Math.PI / 5);
const right = 10 * Math.cos(Math.PI / 10);
assert.ok(Math.abs(paperSupport(p, 0, 1) - down) < 1e-6);
assert.equal(paperSupport(p, 0, -1), 5, 'upward star tip');
assert.ok(Math.abs(paperSupport(p, 1, 0) - right) < 1e-6);
p.angle = Math.PI / 2;
assert.ok(Math.abs(paperSupport(p, 0, 1) - right) < 1e-6, 'rotated star width');
p.angle = 0;p.flip = Math.PI / 2;
assert.ok(Math.abs(paperSupport(p, 0, 1) - down * .12) < 1e-6, 'edge-on star outline');
const c = new Confetti();
c.modelReady = true;
c.trigger(1000);
for (let i = 0; i < 160; i++) c.spawn(i, 1000);
assert.equal(
  c.particles.filter((p) => p.state).length,
  160,
  'all particles are stars',
);
const unit = c.height * 0.9 * (c.width > c.height ? 1.2 : 0.95);
for (const p of c.particles)
  if (p.state) {
    assert.ok(p.w >= unit * 0.0396 && p.w <= unit * 0.0792);
    assert.equal(p.h, p.w);
  }
assert.equal(c.particles.length, 160, 'pool fits the maximum round');
console.log(
  'PASS paper size, five-point outline, rotated and edge-on contact support',
);

const free = new Confetti(),
  hair = new Confetti();
for (const engine of [free, hair]) {
  engine.modelReady = true;
  engine.trigger(1000);
}
hair.surfaces.set('frontHair', {
  id: 'frontHair',
  frame: { x: 0, y: 0, scale: 100, angle: 0 },
  previous: { x: 0, y: 0, scale: 100, angle: 0 },
  segments: [[1, 1, 1.02, 1]],
  patchIds: [7],
  patchIndex: new Map([[7, 0]]),
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
});
free.spawn(1, 1000);
hair.spawn(1, 1000);
assert.equal(hair.particles[1].interior, true);
assert.equal(
  hair.particles[1].w,
  free.particles[1].w,
  'hair uses the same full width',
);
assert.equal(
  hair.particles[1].h,
  free.particles[1].h,
  'hair uses the same full height',
);
console.log('PASS no region-dependent paper shrinking');

const rolling = { w: 40, h: 40, angle: 0, flip: Math.PI, state: 1 };
const airborneSupport = paperSupport(rolling, 0, 1);
const landedSupport = paperSupport(
  { ...rolling, state: 2, backFace: true, flip: 0 },
  0,
  1,
);
assert.equal(
  airborneSupport,
  landedSupport,
  'back-facing star retains its outline at contact',
);
assert.ok(
  c.particles.filter((p) => p.state).every((p) => Math.abs(p.spin) >= 1.2),
  'all stars have visible spin',
);
assert.ok(
  c.particles.some((p) => p.spin < 0) && c.particles.some((p) => p.spin > 0),
  'mixed rotation directions',
);
console.log('PASS tumbling directions and continuous back-face landing');

const oblique = {
  w: 40,
  h: 40,
  angle: 0,
  flip: Math.acos(0.4),
  state: 2,
  tiltAxis: Math.PI / 2,
};
assert.ok(
  paperSupport(oblique, 1, 0) < paperSupport({ ...oblique, tiltAxis: 0 }, 1, 0),
  'tilt axis changes the projected contact outline',
);
