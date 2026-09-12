import assert from 'node:assert/strict';
import { Confetti } from '../lib/confetti.ts';
for (const count of [100, 160]) {
  const c = new Confetti();
  c.width = 1000;
  c.height = 800;
  c.modelReady = true;
  c.trigger(1000, count);
  const make = (id, segments, capacity = 6) => ({
    id,
    frame: { x: 0, y: 0, scale: 1000, angle: 0 },
    previous: { x: 0, y: 0, scale: 1000, angle: 0 },
    segments,
    timestamp: 1000,
    poseTime: 1000,
    valid: true,
    capacity,
  });
  c.surfaces.set('hair', make('hair', [[0.4, 0.15, 0.6, 0.15]]));
  c.surfaces.set('left', make('left', [[0.1, 0.6, 0.3, 0.6]]));
  c.surfaces.set('right', make('right', [[0.7, 0.6, 0.9, 0.6]]));
  const hair = make(
    'frontHair',
    Array.from({ length: 16 }, (_, i) => {
      const x = i < 8 ? 0.34 : 0.66;
      const y = 0.25 + (i % 8) * 0.045;
      return [x - 0.016, y, x + 0.016, y];
    }),
  );
  hair.patchIds = Array.from({ length: 16 }, (_, i) => i);
  hair.patchIndex = new Map(hair.patchIds.map((id, i) => [id, i]));
  c.surfaces.set('frontHair', hair);
  let maxCrown = 0,
    maxHair = 0,
    planned = 0;
  const seen = new Set();
  const origins = [];
  for (let step = 1; step <= 420; step++) {
    const t = 1000 + (step * 1000) / 60;
    for (const s of c.surfaces.values()) {
      s.timestamp = t;
      s.poseTime = t;
    }
    c.step(1 / 60, t);
    for (const p of c.particles)
      if (p.state && !seen.has(p.id)) {
        seen.add(p.id);
        if (p.plannedSurface) {
          planned++;
          origins.push(p.x);
        }
      }
    maxCrown = Math.max(
      maxCrown,
      c.particles.filter((p) => p.state === 1 && p.plannedSurface === 'hair')
        .length,
    );
    maxHair = Math.max(
      maxHair,
      c.particles.filter(
        (p) => p.state === 1 && p.plannedSurface === 'frontHair',
      ).length,
    );
  }
  assert.ok(planned <= count / 2, 'majority stays free');
  assert.ok(maxCrown <= 3, 'no repeated crown queue');
  assert.ok(maxHair <= 16, 'no repeated hair queue');
  assert.ok(
    c.landed.hair >= 2 && c.landed.hair <= 3,
    'crown receives continuous landings',
  );
  assert.ok(c.landed.frontHair >= 8, 'front hair receives main share');
  assert.ok(
    c.landed.left >= 3 && c.landed.right >= 3,
    'both shoulders receive landings',
  );
  assert.equal(c.particles.filter((p) => p.state).length, 0, 'round recycles');
  console.log({
    count,
    planned,
    landed: c.landed,
    originSpan: Math.max(...origins) - Math.min(...origins),
  });
}
