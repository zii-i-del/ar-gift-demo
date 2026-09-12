import { Interaction } from '../lib/interaction.ts';
import { performance } from 'node:perf_hooks';
// 120 seconds of simulated 60 Hz time, NOT camera/render FPS or wall-clock duration.
function run(enabled) {
  const e = new Interaction();
  e.reset('bubble');
  e.width = 1280;
  e.height = 720;
  const costs = [];
  for (let i = 0; i < 7200; i++) {
    const now = (i * 1000) / 60;
    for (let j = 0; j < 20; j++) {
      const b = e.bubbles[j];
      if (!b.active || b.pop >= 0)
        Object.assign(b, {
          active: true,
          x: 440 + j * 21,
          y: 160 + (j % 4) * 100,
          r: 26,
          age: 0,
          pop: -1,
          vx: (j % 2 ? 1 : -1) * 180,
          vy: 90,
          owner: null,
          candidate: null,
        });
    }
    if (enabled)
      e.acceptHead({
        x: 640 + Math.sin(i / 90) * 80,
        y: 360,
        rx: 100,
        ry: 145,
        angle: Math.sin(i / 120) * 0.3,
        vx: Math.cos(i / 90) * 53,
        vy: 0,
        omega: Math.cos(i / 120) * 0.15,
        timestamp: now,
        reset: false,
      });
    const start = performance.now();
    e.step(1 / 60, now);
    costs.push(performance.now() - start);
  }
  costs.sort((a, b) => a - b);
  return {
    meanMs: costs.reduce((a, b) => a + b, 0) / costs.length,
    p95Ms: costs[Math.floor(costs.length * 0.95)],
    maxMs: costs.at(-1),
  };
}
run(false);
run(true);
console.log(
  JSON.stringify(
    {
      scope:
        '7200 steps, 20 bubbles; Node simulation only; same-build head-off control',
      withoutHead: run(false),
      withHead: run(true),
    },
    null,
    2,
  ),
);
