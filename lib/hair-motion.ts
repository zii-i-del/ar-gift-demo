export type HairGrid = { w: number; h: number; data: Uint8Array };
// Binary-mask correspondence only: uniform interiors cannot prove motion.
// Prefer no movement on ties; reject unsupported/large changes instead of guessing.
export function hairMotion(a: HairGrid, b: HairGrid, x: number, y: number) {
  if (a.w !== b.w || a.h !== b.h) return { x: 0, y: 0 };
  const cx = Math.round(x * a.w),
    cy = Math.round(y * a.h);
  if (cx < 6 || cy < 6 || cx >= a.w - 6 || cy >= a.h - 6) return { x: 0, y: 0 };
  let ones = 0;
  for (let yy = -3; yy <= 3; yy++)
    for (let xx = -3; xx <= 3; xx++)
      ones += a.data[(cy + yy) * a.w + cx + xx] ? 1 : 0;
  if (ones < 4 || ones > 45) return { x: 0, y: 0 };
  const cost = (dx: number, dy: number) => {
    let n = 0;
    for (let yy = -3; yy <= 3; yy++)
      for (let xx = -3; xx <= 3; xx++)
        n +=
          a.data[(cy + yy) * a.w + cx + xx] !==
          b.data[(cy + yy + dy) * b.w + cx + xx + dx]
            ? 1
            : 0;
    return n;
  };
  const baseline = cost(0, 0);
  let best = baseline,
    dx = 0,
    dy = 0;
  for (let yy = -3; yy <= 3; yy++)
    for (let xx = -3; xx <= 3; xx++) {
      const n = cost(xx, yy);
      if (n < best || (n === best && xx * xx + yy * yy < dx * dx + dy * dy)) {
        best = n;
        dx = xx;
        dy = yy;
      }
    }
  return baseline - best >= 7 && best <= 7
    ? { x: dx / a.w, y: dy / a.h }
    : { x: 0, y: 0 };
}
