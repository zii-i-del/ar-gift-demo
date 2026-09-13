import assert from 'node:assert/strict';
import { collideHead, readHead } from '../lib/head.ts';
import { Interaction } from '../lib/interaction.ts';
const head = {
  x: 400,
  y: 300,
  rx: 90,
  ry: 120,
  angle: 0,
  timestamp: 1000,
  vx: 0,
  vy: 0,
  omega: 0,
  reset: false,
};
const body = (x, y, vx, vy) => ({ x, y, vx, vy, r: 20, age: 1 });
for (const [px, py, x, y, vx, vy, axis, sign] of [
  [280, 300, 300, 300, 240, 0, 'vx', -1],
  [520, 300, 500, 300, -240, 0, 'vx', 1],
  [400, 150, 400, 170, 0, 240, 'vy', -1],
  [400, 450, 400, 430, 0, -240, 'vy', 1],
]) {
  const b = body(x, y, vx, vy);
  collideHead(b, px, py, head, 1 / 60, 1000, 800, 600);
  assert.ok(b[axis] * sign > 0, 'correct outward rebound');
  assert.equal(b.squash, 0.18);
}
const stationary = body(400, 165, 0, 200);
collideHead(stationary, 400, 150, head, 1 / 60, 1000, 800, 600);
const moving = body(400, 165, 0, 200);
collideHead(moving, 400, 150, { ...head, vy: -100 }, 1 / 60, 1000, 800, 600);
assert.ok(moving.vy < stationary.vy, 'active head gives stronger rebound');
const fast = body(550, 300, 420, 0);
collideHead(fast, 200, 300, head, 1 / 60, 1000, 800, 600);
assert.ok(fast.x < 300 && fast.vx < 0, 'sweep catches crossing');
const away = body(278, 300, -120, 0);
collideHead(away, 280, 300, head, 1 / 60, 1000, 800, 600);
assert.equal(away.vx, -120);
const grazing = body(500, 140, 100, 0);
collideHead(grazing, 300, 140, head, 1 / 60, 1000, 800, 600);
assert.equal(grazing.vx, 100);
assert.equal(grazing.x, 500);
for (const extra of [{ reset: true }, { timestamp: 700 }]) {
  const b = body(400, 300, 12, -10);
  collideHead(b, 400, 300, { ...head, ...extra }, 1 / 60, 1000, 800, 600);
  assert.equal(b.vx, 12);
  assert.equal(b.vy, -10);
}
const spawn = { ...body(400, 300, 12, -10), age: 0 };
collideHead(spawn, 400, 300, head, 1 / 60, 1000, 800, 600);
assert.equal(spawn.vx, 12);
assert.ok(Math.hypot(spawn.x - 400, spawn.y - 300) > 100);
const rot = body(285, 300, 240, 0);
collideHead(
  rot,
  270,
  300,
  { ...head, angle: Math.PI / 4, omega: 1 },
  1 / 60,
  1000,
  800,
  600,
);
assert.ok(rot.vx < 0 && rot.squash > 0, 'rotated contact');
const raw = Array(468 * 3).fill(0);
for (const [i, x, y] of [
  [234, 0.35, 0.5],
  [454, 0.65, 0.5],
  [10, 0.5, 0.25],
  [152, 0.5, 0.75],
]) {
  raw[i * 3] = x;
  raw[i * 3 + 1] = y;
}
const first = readHead(raw, 800, 600, 800, 600, 1000, null);
assert.ok(first.reset);
const tracked = readHead(raw, 800, 600, 800, 600, 1067, first);
assert.ok(!tracked.reset);
assert.equal(tracked.vx, 0);
assert.ok(readHead(raw, 800, 600, 800, 600, 1400, tracked).reset);
assert.equal(readHead(null, 800, 600, 800, 600, 1400, tracked), null);
const engine = new Interaction();
engine.reset();
engine.width = 800;
engine.height = 600;
const b = engine.bubbles[0];
Object.assign(b, { ...body(25, 300, -100, 0), active: true, pop: -1 });
for (let i = 0; i < 120; i++) {
  engine.acceptHead({ ...head, x: 110, timestamp: 1000 + (i * 1000) / 60 });
  engine.step(1 / 60, 1000 + (i * 1000) / 60);
  assert.ok(b.x >= b.r && b.x <= 800 - b.r);
  assert.ok(Math.hypot(b.vx, b.vy) <= 420.001);
}
console.log(
  'PASS: four directions, active head, swept crossing, separation, grazing, reset/stale, spawn, rotation, edge confinement',
);
