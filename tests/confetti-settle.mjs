import assert from 'node:assert/strict';
import { Confetti, paperSupport } from '../lib/confetti.ts';
for (const region of ['hair', 'left', 'right', 'frontHair']) {
  const c = new Confetti();
  c.modelReady = true;
  c.trigger(1000);
  c.count = 0;
  const frame = { x: 0, y: 0, scale: 100, angle: 0 };
  const s = {
    id: region,
    frame,
    previous: { ...frame },
    segments: [[0, 1, 6, 1]],
    timestamp: 1000,
    poseTime: 1000,
    valid: true,
    capacity: 6,
    patchIds: [1],
    patchIndex: new Map([[1, 0]]),
  };
  c.surfaces.set(region, s);
  const p = c.particles[0];
  Object.assign(p, {
    state: 1,
    x: 100,
    y: 75,
    px: 100,
    py: 75,
    w: 20,
    h: 15,
    vy: 1000,
    vx: 0,
    angle: 0.8,
    flip: 0,
    front: false,
    interior: region === 'frontHair',
    patchId: 1,
    fadeAt: -1,
  });
  for (let n = 1; n <= 10 && p.state === 1; n++) {
    s.timestamp = s.poseTime = 1000 + n * 17;
    c.step(1 / 60, s.timestamp);
  }
  assert.equal(p.state, 2, 'continuous contact');
  const incoming = 0.8; // final target should keep the arriving rotation, not zero out.
  for (let n = 11; n <= 40; n++) {
    s.timestamp = s.poseTime = 1000 + n * 17;
    c.step(1 / 60, s.timestamp);
  }
  if (region === 'frontHair') {
    assert.ok(
      Math.abs(p.angle) > 0.4,
      'front hair retains a non-upright direction',
    );
    assert.ok(
      Math.abs(Math.cos(p.flip)) >= 0.3,
      'front hair remains a visible sheet',
    );
  } else {
    assert.ok(Math.abs(Math.cos(p.flip)) < 0.53, 'top surfaces flatten');
    assert.ok(
      Math.abs(p.y + paperSupport(p, 0, 1) - 100) < 1e-5,
      'paper edge remains on surface while flattening',
    );
  }
}
console.log(
  'PASS varied front hair orientation and supported flattened crown/shoulders',
);
