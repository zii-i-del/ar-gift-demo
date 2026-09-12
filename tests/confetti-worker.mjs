import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const messages = [],
  calls = [];
let now = 100,
  failHair = false;
const fake = {
  FaceLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('face');
        return { faceLandmarks: [], faceBlendshapes: [] };
      },
    }),
  },
  HandLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('hands');
        return { landmarks: [], worldLandmarks: [], handedness: [] };
      },
    }),
  },
  ImageSegmenter: {
    createFromOptions: async () => ({
      segmentForVideo: (image, t, cb) => {
        calls.push('hair');
        if (failHair) throw Error('test inference failure');
        cb({ confidenceMasks: [null, null] });
      },
    }),
  },
  PoseLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('pose');
        return {
          landmarks: [],
          segmentationMasks: [],
          close() {
            calls.push('pose-close');
          },
        };
      },
    }),
  },
  FilesetResolver: { forVisionTasks: async () => ({}) },
};
const context = {
  Vision: fake,
  performance: {
    get timeOrigin() {
      return 100000;
    },
    now: () => now,
  },
  OffscreenCanvas: class {
    getContext() {
      return { clearRect() {}, drawImage() {} };
    }
  },
  importScripts() {},
  ConfettiSurfaces: {
    hair: () => [],
    shoulders: () => ({ left: [], right: [] }),
  },
  self: { postMessage: (m) => messages.push(m) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('public/tracking-worker.js', 'utf8'), context);
await context.self.onmessage({
  data: { type: 'start', scene: 'confetti', timeOrigin: 90000 },
});
assert.ok(messages.some((m) => m.type === 'ready'));
await context.self.onmessage({
  data: { type: 'configure', phase: 'playing', low: false },
});
let closed = 0;
for (let i = 0; i < 20; i++) {
  now += 100;
  const before = calls.filter((t) => t !== 'pose-close').length;
  await context.self.onmessage({
    data: {
      type: 'frame',
      timestamp: now + 10000,
      image: {
        width: 640,
        height: 480,
        close() {
          closed++;
        },
      },
    },
  });
  assert.ok(
    calls.filter((t) => t !== 'pose-close').length - before <= 1,
    'one inference per frame',
  );
}
assert.ok(calls.includes('hair'));
assert.ok(calls.includes('pose'));
assert.ok(!calls.includes('hands'), 'hands off while playing');
assert.equal(closed, 20);
assert.equal(messages.filter((m) => m.type === 'frame-done').length, 20);
const before = calls.length;
await context.self.onmessage({
  data: {
    type: 'frame',
    timestamp: now + 9000,
    image: {
      close() {
        closed++;
      },
    },
  },
});
assert.equal(calls.length, before, 'stale frame dropped across time origins');
failHair = true;
for (let i = 0; i < 10; i++) {
  now += 200;
  await context.self.onmessage({
    data: {
      type: 'frame',
      timestamp: now + 10000,
      image: {
        width: 640,
        height: 480,
        close() {
          closed++;
        },
      },
    },
  });
}
assert.ok(
  messages.some((m) => m.task === 'hair' && m.error && m.valid === false),
);
assert.equal(messages.filter((m) => m.type === 'frame-done').length, 31);
console.log(
  'PASS worker: time-origin correction, one task/frame, stage scheduling, pose mask cleanup, error completion, stale frame dropping',
);
// Simulate the main thread obeying capture admission; no images for idle ticks.
failHair = false;
let captures = 0;
for (let i = 0; i < 600; i++) {
  now += 1000 / 60;
  const next = messages.findLast(
    (m) => m.type === 'capture-schedule',
  )?.nextCaptureAt;
  if (now + 10000 < next) continue;
  const n = calls.filter((t) => t !== 'pose-close').length;
  await context.self.onmessage({
    data: {
      type: 'frame',
      timestamp: now + 10000,
      image: { width: 640, height: 480, close() {} },
    },
  });
  assert.equal(
    calls.filter((t) => t !== 'pose-close').length,
    n + 1,
    'admitted capture executes one task',
  );
  captures++;
}
assert.ok(
  captures < 350,
  `capture count ${captures} should be below 60 Hz for 10 s`,
);
await context.self.onmessage({
  data: { type: 'configure', phase: 'playing', low: true },
});
assert.equal(
  vm.runInContext('rates().pose', context),
  5,
  'low shoulder interval leaves freshness headroom',
);
await context.self.onmessage({
  data: { type: 'configure', phase: 'idle', low: false },
});
assert.ok(
  vm.runInContext('rates().hands', context) > 0,
  'hands resume after playing',
);
assert.equal(
  vm.runInContext('rates().hair', context),
  2,
  'idle segmentation stays low',
);
console.log(
  `PASS capture admission: ${captures}/600 ticks need images; low-mode shoulder headroom, idle rates`,
);
await context.self.onmessage({
  data: { type: 'configure', phase: 'finishing', low: false },
});
assert.equal(
  vm.runInContext('rates().hands', context),
  6,
  'hands return only at low rate in ending phase',
);
assert.equal(vm.runInContext('rates().hair', context), 5);
assert.equal(vm.runInContext('rates().pose', context), 4);
await context.self.onmessage({
  data: { type: 'configure', phase: 'playing', low: false },
});
assert.equal(
  vm.runInContext('rates().hands', context),
  0,
  'normal playback still skips hands',
);
console.log('PASS bounded end-phase hand inference rates');
