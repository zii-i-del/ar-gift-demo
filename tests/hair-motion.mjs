import assert from 'node:assert/strict';
import { hairMotion } from '../lib/hair-motion.ts';
import { Confetti } from '../lib/confetti.ts';
const grid = (dx = 0) => ({
  w: 32,
  h: 32,
  data: Uint8Array.from({ length: 1024 }, (_, i) => +(i % 32 >= 16 + dx)),
});
assert.deepEqual(hairMotion(grid(), grid(), 0.5, 0.5), { x: 0, y: 0 });
assert.deepEqual(hairMotion(grid(), grid(2), 0.5, 0.5), { x: 2 / 32, y: 0 });
const uniform = { w: 32, h: 32, data: new Uint8Array(1024).fill(1) };
assert.deepEqual(
  hairMotion(uniform, uniform, 0.5, 0.5),
  { x: 0, y: 0 },
  'uniform hair cannot imply movement',
);
const c = new Confetti();
c.modelReady = true;
c.trigger(1000);
c.count = 0;
const p = c.particles[0];
Object.assign(p, {
  state: 2,
  hairFixed: true,
  surface: 'frontHair',
  x: 100,
  y: 200,
  angle: 0.2,
  targetAngle: 0.2,
  fadeAt: -1,
});
c.surfaces.set('frontHair', {
  id: 'frontHair',
  frame: { x: 500, y: 400, scale: 300, angle: 1 },
  previous: { x: 0, y: 0, scale: 100, angle: 0 },
  segments: [],
  timestamp: 1000,
  poseTime: 1000,
  valid: true,
});
c.step(1 / 60, 1010);
assert.equal(p.x, 100);
assert.equal(p.y, 200);
assert.equal(
  p.angle,
  0.2,
  'face rotation does not rotate settled hair decoration',
);
console.log(
  'PASS hair mask motion, zero-motion preference and face-independent hair landings',
);

// Exercise the actual attached-particle inverse mapping on mismatched source ratios.
for(const [w,h,sw,sh] of [[640,360,640,480],[360,640,640,480]]){
 const e=new Confetti();e.resize(w,h,sw,sh);const origin=e.map(.5,.5),q=e.particles[0];
 Object.assign(q,{state:2,hairFixed:true,x:origin.x,y:origin.y});
 const packet=(t,g)=>({task:'hair',valid:true,timestamp:t,duration:1,lines:[],patches:[],hairGrid:g});
 e.accept(packet(100,grid()),100);e.accept(packet(200,grid(2)),200);
 const expected=e.map(.5+2/32,.5);
 assert(Math.abs(q.x-expected.x)<1e-8,'mask displacement uses the same contain/cover mapping as the camera');
 assert(Math.abs(q.y-expected.y)<1e-8);
}
console.log('PASS attached hair motion uses landscape contain and portrait cover on mismatched sources');
