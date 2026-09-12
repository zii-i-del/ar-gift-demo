# Head / bubble local validation

Implemented independent `lib/head.ts`, shared mirrored cover mapping, one face ellipse,
full bubble radius, bounded relative-motion sweep including angular motion, normal
restitution 0.40 and tangent retention 0.95. Contact speed capped at 420 px/s.
Contact squash is at most 8%, restored in 180 ms; it does not pop bubbles.
Spawn/reacquire overlaps only depenetrate; viewport constraints override the head
when no space remains. Tracking expires after 200 ms and prediction stops at 100 ms.
Head outline is an approximation of hair, not hair segmentation or 3D depth.

Simulation is fixed 60 Hz, at most three steps per rendered frame. Long gaps discard
accumulated time. Existing worker count, inference queue, emission rules and pool
size (20) are unchanged. Unrelated heart-renderer work is preserved.

## Checks performed

- `tests/head-collision.mjs`: left/right/top/chin rebound, stronger moving-head
  response, swept crossing, grazing/separation, reset/stale data, spawn overlap,
  rotated contact, viewport confinement and speed bounds.
- `tests/index-only.mjs`: both hands, index accepted, thumb/crossed-heart excluded.
- `tests/bubble-emission.mjs`: first emission 450 ms, continuous generation,
  jitter tolerance, pool reuse beyond 20 emissions, withdrawal stops generation.
- `tests/interaction-regression.mjs`: hand impact/travel/bounds and occlusion continuity.
- Vinext production build passed. Scoped lint for physics modules passed.
- Full TypeScript check still reports existing errors in heart-preview/page.tsx
  (GLB loading argument) and vite.config.ts (hosting d1/r2 typing). These files
  were not changed for head collisions. Build success is not a clean whole-project
  type check.

## Performance scope

`tests/head-performance.mjs` runs 7200 fixed steps (120 seconds of simulated time),
maintains 20 active bubbles, and compares the same engine with head collision off/on.
One local Node run: off mean 0.000354 ms, P95 0.000375 ms; on mean 0.001110 ms,
P95 0.002084 ms, max 0.054458 ms. These are microbenchmark values, not browser FPS,
not two minutes of wall-clock camera use, and not a historical build comparison.

## Still requires camera verification

Open localhost:3001, select bubble, enable camera. Generate bubbles with an extended
index finger, push them toward each face side, and compare a stationary head with an
active head bump. Check head rotations, distance changes, occlusion, window resizing,
and head near each viewport edge. Use ?debug=1 only to inspect the outline/contact
normal. Normal mode hides these overlays.

Actual 1080p camera + rendering FPS, two-minute device comparison, and subjective
head/hair alignment have NOT been signed off by simulation or build success.

## Unified contact and directional heart-flow update

Head and palm use the same respondContact function and fixed-step swept collision
path; owner/candidate support and tracking-callback impulses were removed. The
actual engine-route comparison returns matching output velocities for equivalent
contact geometry/speed. Squash depends on incoming speed, max 8% over 180 ms.
Heart flow uses 12 fixed slots, max 6 per hand, 350 ms emission interval, 1.9 s life,
100 ms attachment followed by independent velocity. Origin/direction come from the
crossed segments; generic index tip remains unchanged. GLB and PNG paths updated.

New tests/heart-flow.mjs verifies origins/directions, independent old trajectories,
bounded sustained double-hand emission, release, lifetime, closest segments and
matching head/palm contact response. Existing index/emission/head/hand regression
suites pass; the hand regression now steps physics instead of expecting impulses
inside a tracking callback.

Latest Node 7200-step 20-bubble run: no-head mean 0.000348 ms/P95 0.000334 ms;
with-head mean 0.001209 ms/P95 0.002375 ms. This is still a simulation microbenchmark.
Actual 2-minute camera/render comparison and subjective material/flow approval
remain pending. The production build and scoped physics/renderer lint passed.
