# Gun gesture calibration — 2026-09-11

Three user-labelled screenshots were processed locally using the installed MediaPipe
HandLandmarker (GPU, IMAGE mode, same hand model as the application). No images
were uploaded. The fixture contains only normalized landmark results and source
image dimensions, not screenshots. Screenshot recognition is not equivalent to
live-video tracking and the full screenshot includes UI around the camera image.

Measured index joint deflections in screen space:
- Positive standard gun: 8°, 6°.
- Negative hooked index 1: 52°, 20°.
- Negative hooked index 2: 65°, 13°.

The positive example was previously excluded by supporting-finger closure tests:
its three PIP deflections were roughly 47–53°, rather than the required >69°,
and chain ratios 0.82–0.85 exceeded the required <0.8.

Changes retain an index-chain hard gate (each joint <35°, whole-chain ratio >0.93).
Supporting fingers each require positive bend evidence (>about 40°), compressed
chain (<0.90), and a tip closer to the wrist than the PIP. The thumb extension,
separation, and heart exclusions remain. No temporal tolerance can bypass a
failed index gate. Emission cadence, physics, density and materials are unchanged.

`tests/gun-real.mjs` checks positive/negative classification and actual emitter
behavior on original and mirrored landmark sets. `tests/bubble-stream.mjs`
checks synthetic nonstandard fingers, stop/stale handling, gun versus index-only,
96-slot capacity and two simulated minutes. These are not measured webcam FPS or
live recognition precision. `?debug=1` shows per-hand rejection reason and index
angles; ordinary mode does not show these diagnostics.

Remaining: live comparison of the standard pose and hooked-index pose on both
hands, including natural rotations and short occlusions.

## 2026-09-11: world-landmark validation (local candidate, not accuracy sign-off)

Live Worker now returns the existing model's world landmarks. Gun classification uses
3D PIP/DIP bending and finger-chain ratios, plus a 2D clear-bend veto and thumb separation.
Missing world data never falls back to the previous 2D classifier. No model, inference
frequency or bubble pool change. Debug shows both joint-angle pairs and successful
per-hand birth count (old visible bubbles are not evidence of ongoing emission).

Passed: original three screenshot landmark samples and mirrored inputs (straight true,
hooked false/false); 3D rotation invariance; missing world rejection; 3D bend with a
straight 2D projection; immediate stop after previously confirmed emission; stream,
heart and collision regression scripts; production build.

Continuous recording Screen-2026-09-11-013358.mp4 was re-inferred in VIDEO mode at 15Hz,
518 frames / 977 detected hands. This is an offline cropped screen-recording replay,
including pre-existing effects, not original camera input or real-time performance.
At approximately 15s, both hands still pass the candidate classifier (estimated 3D
index bends 4/24 and 5/29 degrees); at approximately 20s one hand passes (10/16), the
other is uncertain (26/41). These are unresolved errors relative to the user's bent
pose feedback. The new rule MUST NOT be described as solving all video false positives.
At ~5s one hand passes, one is uncertain (9/40). Tightening the joint threshold alone
would reject some straight poses while keeping some incorrectly reconstructed bent
ones. Further tuning needs raw live landmark overlays/recordings to distinguish model
bone placement errors from gesture boundaries. No camera FPS or accuracy claim made.

## Follow-up: screenshots 32f5d1a8 / de1dc9b7

Re-inferred both full screenshots, then only the video rectangles at 640x400.
First screenshot: hand found; cropped index world bends ~15 + 31 degrees,
2D ~14 + 4. Previous sum allowance 48 degrees accepted this cumulative bend.
Candidate sum allowance is now 42 degrees (other joint/ratio guards retained).
Added measured negative fixture; previous straight fixture sums ~40 degrees and
still passes. This margin is small and remains subject to live validation; this
is not evidence of a globally optimal threshold.
Second screenshot: zero hands in both inference attempts, so no joint angle can
be diagnosed. Palm/wrist are clipped at the video bottom; border clipping is a
possible cause, not proven from this still. No permissive emission fallback added.
No-hand feedback now requests the palm and wrist in frame. Explicit missing-hand
results immediately disarm the gun rather than allowing the remaining 200ms
sample lifetime to emit. Recovery must reconfirm. Original detector/model and ROI
pipeline unchanged; only fixed landmark arithmetic and bounded hand-list checks.

## G5 — whole-finger evidence and continuous replay

Adds palm-length-normalized index forward reach >= .5, tip separation >= .48,
and projected chain ratio >= .97. A clear 2D chain (ratio > .99, both bends <15,
forward > .7, separation > .6) can tolerate the soft 3D index uncertainty; hard
3D bend rejection, thumb and all three closed-finger requirements remain active.
No per-frame model/ROI change. Debug overlay is drawn after effects, marked G5.

Screen-2026-09-11-021042.mp4 was re-inferred continuously, cropped to its visible
video rectangle. 23–30s right-side bent pose: 0 / 105 detected hand samples pass.
17s and 35s normal samples on both sides pass; 23s both bent samples and 29s right
bent sample reject, including mirror tests. 9–18s interval: only 76 / 270 hand
samples pass; 191 reject thumb separation/extension. This unresolved false-negative
region must remain visible in reporting. Re-inference includes the recorded bones
and effects and is not equivalent to the live raw input. Do not interpret these
counts as camera accuracy or performance. No claim of complete gesture accuracy.
