# Heart depth and appearance local validation

Birth order is global across hands and captured only on successful emission.
Active hearts sort old-to-new into reusable indices. GLB depth spacing is more
than twice a conservative cached animated model radius times the largest active
instance scale. Orthographic camera clipping and background depth cover all layers.
PNG fallback uses the same birth order. Depth testing and existing fade materials
remain enabled; no per-frame geometry bounds computation.

Model radius covers rigid transforms, translation/scale track extrema, geometry
bounding spheres and arbitrary rotations. Current assets use linear transform
tracks. New assets with deformation or cubic overshoot require revisiting this
bound; current v3/v4/v5 meshes were validated against their animation data.

Appearance uses emitter tilt clamped to +/-27 degrees plus one quarter of spread
(max +/-3), capped +/-30. The existing movement angle, emitter position, speed,
size, cadence and lifetime are preserved. Debug cyan/purple rays show detected
emitter and displayed appearance directions; no new tracking model is involved.

Passed tests/heart-layers.mjs: v3/v4/v5 animated corner bounds, 12 nonintersecting
layers at multiple scales, clipping/background coverage, birth order, pool reuse,
expiry and appearance limits. Existing spacing and flow regressions pass.
Scoped lint passed. Actual blended GPU overlap/fade appearance and real gesture
alignment still require local visual verification; numeric bounds aren't a visual
sign-off. Tests do not claim these virtual layers represent real camera depth.
