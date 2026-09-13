import { Interaction } from '../../lib/interaction.ts';
import { Confetti } from '../../lib/confetti.ts';
import { coverPoint } from '../../lib/coordinates.ts';

// Synthetic deterministic simulation, not camera/model/GPU validation.
const round = n => Math.round(n * 1e5) / 1e5;
function fields(p, names) {
  return names.map(key => typeof p[key] === 'number' ? round(p[key]) : p[key]);
}
export function replayEffects() {
  const result = {};
  const originalRandom = Math.random;
  let seed = 721;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  try {
    for (const [orientation, width, height] of [['landscape', 640, 360], ['portrait', 360, 640]]) {
      const output = result[orientation] = {};
      output.mapping = [1280, 640].map(sw => [
        coverPoint(0, 0, width, height, sw, 720),
        coverPoint(.5, .5, width, height, sw, 720),
        coverPoint(1, 1, width, height, sw, 720),
      ]);
      for (const kind of ['hearts', 'bubble']) {
        const e = new Interaction(); e.reset(); e.width = width; e.height = height;
        const hand = { id: 'A', span: 60, tip: { x: width * .5, y: height * .7 },
          anchor: { x: width * .5, y: height * .8 }, wrist: { x: width * .5, y: height * .9 },
          heartOrigin: { x: width * .5, y: height * .7 }, heartDirection: { x: 0, y: -1 },
          heart: kind === 'hearts', heartPossible: false, gun: kind === 'bubble',
          gunDirection: { x: 0, y: -1 }, palm: false, pointing: false, reach: 0 };
        const births = [], snapshots = [];
        for (let n = 0; n <= 180; n++) {
          const now = n * 1000 / 60;
          if (n % 5 === 0) e.acceptHands([hand], now);
          const before = e.emittedHearts + e.emittedBubbles;
          e.step(1 / 60, now);
          if (e.emittedHearts + e.emittedBubbles > before) births.push(round(now));
          if ([60, 120, 180].includes(n)) snapshots.push((kind === 'hearts' ? e.hearts : e.bubbles)
            .filter(p => p.active).map(p => fields(p, kind === 'hearts'
              ? ['birthOrder', 'x', 'y', 'vx', 'vy', 'size', 'angle', 'colorOrder']
              : ['birthOrder', 'x', 'y', 'vx', 'vy', 'r', 'targetR', 'pop'])));
        }
        output[kind] = { births, snapshots };
      }
      const c = new Confetti(); c.resize(width, height, width, height); c.modelReady = true; c.trigger(1000);
      const snapshots = [];
      for (let n = 0; n <= 420; n++) {
        c.step(1 / 60, 1000 + n * 1000 / 60);
        if ([30, 120, 240, 420].includes(n)) snapshots.push({ emitted: c.emitted, active: c.active,
          particles: c.particles.filter(p => p.state).slice(0, 6)
            .map(p => fields(p, ['id', 'x', 'y', 'w', 'h', 'angle', 'flip', 'alpha', 'state'])) });
      }
      output.stars = { count: c.count, snapshots };
      output.contacts = {};
      for (const region of ['hair', 'frontHair', 'left', 'right']) {
        const c = new Confetti(); c.resize(width, height, width, height); c.modelReady = true; c.trigger(1000); c.count = 0;
        const frame = { x: 0, y: 0, scale: 100, angle: 0 };
        const surface = { id: region, frame, previous: { ...frame }, segments: [[0, 1, 6, 1]],
          timestamp: 1000, poseTime: 1000, valid: true, capacity: 6, patchIds: [1], patchIndex: new Map([[1, 0]]) };
        c.surfaces.set(region, surface); c.spawn(0, 1000);
        const p = c.particles[0];
        Object.assign(p, { x: 100, y: 0, px: 100, py: 0, vy: 5000, vx: 0, angle: .8, flip: 0,
          front: false, interior: region === 'frontHair', patchId: 1 });
        const trace = [];
        for (let n = 1; n <= 40; n++) {
          surface.timestamp = surface.poseTime = 1000 + n * 1000 / 60;
          c.step(1 / 60, surface.timestamp);
          if ([1, 10, 40].includes(n)) trace.push(fields(p, ['id', 'state', 'surface', 'x', 'y', 'w', 'h', 'angle', 'flip']));
        }
        output.contacts[region] = trace;
      }
    }
    return result;
  } finally { Math.random = originalRandom; }
}
