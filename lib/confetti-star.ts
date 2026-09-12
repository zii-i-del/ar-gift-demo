// Shared ten-point outline: rendering and contact use exactly the same star.
export const STAR_POINTS: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: 10 },
  (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5,
      radius = i % 2 === 0 ? 0.5 : 0.22;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  },
);
