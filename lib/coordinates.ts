// Landscape shows the complete camera frame; portrait retains its 9:16 crop.
export function cameraScale(width: number, height: number, sourceWidth: number, sourceHeight: number) {
  return (width >= height ? Math.min : Math.max)(width / sourceWidth, height / sourceHeight);
}

export function coverPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
): { x: number; y: number } {
  const scale = cameraScale(width, height, sourceWidth, sourceHeight);
  return {
    x: width - (x * sourceWidth * scale + (width - sourceWidth * scale) / 2),
    y: y * sourceHeight * scale + (height - sourceHeight * scale) / 2,
  };
}
