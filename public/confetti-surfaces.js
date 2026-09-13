/* Mask processing shared by the classic Worker and deterministic tests. */
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function grid(mask, threshold = 0.65) {
    const w = 128,
      h = Math.max(32, Math.round((128 * mask.height) / mask.width)),
      data = new Uint8Array(w * h),
      src = mask.getAsFloat32Array();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        data[y * w + x] =
          src[
            Math.min(mask.height - 1, Math.floor((y * mask.height) / h)) *
              mask.width +
              Math.min(mask.width - 1, Math.floor((x * mask.width) / w))
          ] >= threshold
            ? 1
            : 0;
    return { data, w, h };
  }
  function component(g, box) {
    const { w, h, data } = g,
      seen = new Uint8Array(data.length),
      q = new Int32Array(data.length);
    let best = [],
      scoreBest = 0;
    for (let i = 0; i < data.length; i++)
      if (data[i] && !seen[i]) {
        let a = 0,
          b = 1,
          score = 0;
        q[0] = i;
        seen[i] = 1;
        while (a < b) {
          const j = q[a++],
            x = j % w,
            y = (j / w) | 0;
          if (
            x / w >= box[0] &&
            x / w <= box[2] &&
            y / h >= box[1] &&
            y / h <= box[3]
          )
            score++;
          for (const n of [
            x > 0 ? j - 1 : -1,
            x < w - 1 ? j + 1 : -1,
            y > 0 ? j - w : -1,
            y < h - 1 ? j + w : -1,
          ])
            if (n >= 0 && data[n] && !seen[n]) {
              seen[n] = 1;
              q[b++] = n;
            }
        }
        if (score > scoreBest && b > 20) {
          scoreBest = score;
          best = Array.from(q.subarray(0, b));
        }
      }
    const out = new Uint8Array(data.length);
    for (const i of best) out[i] = 1;
    return { ...g, data: out };
  }
  function top(g, box, count) {
    const { w, h, data } = g,
      points = [],
      xmin = clamp(Math.floor(box[0] * w), 0, w - 1),
      xmax = clamp(Math.ceil(box[2] * w), 0, w - 1),
      ymin = clamp(Math.floor(box[1] * h), 0, h - 1),
      ymax = clamp(Math.ceil(box[3] * h), 0, h - 1),
      step = Math.max(1, Math.ceil((xmax - xmin + 1) / count));
    for (let x = xmin; x <= xmax; x += step) {
      let hit = -1;
      for (let y = ymin; y <= ymax - 2; y++)
        if (data[y * w + x] && data[(y + 1) * w + x] && data[(y + 2) * w + x]) {
          hit = y;
          break;
        }
      points.push(hit <= ymin ? null : [(x + 0.5) / w, hit / h]);
    }
    const lines = [];
    let run = [];
    for (const p of points) {
      if (
        !p ||
        (run.length && Math.abs(p[1] - run[run.length - 1][1]) * h > 8)
      ) {
        if (run.length > 1) lines.push(run);
        run = [];
      }
      if (p) run.push(p);
    }
    if (run.length > 1) lines.push(run);
    return lines;
  }
  // Sparse candidates in a face-relative grid. Every support pixel must be hair;
  // forehead coordinates alone never create a fringe candidate.
  function patches(g, face) {
    const x = (i) => face[i * 3],
      y = (i) => face[i * 3 + 1];
    const fw = Math.abs(x(234) - x(454)),
      fh = Math.abs(y(152) - y(10));
    const cx = (x(234) + x(454)) / 2,
      topY = y(10) - fh * 0.7;
    const out = [];
    if (fw < 0.04 || fh < 0.05) return out;
    // Fixed low-discrepancy candidates fill an area without rows or columns.
    // IDs do not depend on the current mask, so repeated detections remain stable.
    for (let id = 0; id < 192; id++) {
      const hash = ((id * 73 + 17) % 193) / 193;
      const px = cx + fw * (-1 + 2 * ((0.5 + id * 0.7548776662466927) % 1));
      const py = topY + fh * 2.4 * ((0.5 + id * 0.5698402909980532) % 1);
      if (py > y(152) + fh * 0.65) continue;
      const radius = fw * 0.045;
      const x0 = Math.floor((px - radius) * g.w),
        x1 = Math.ceil((px + radius) * g.w);
      const y0 = Math.floor((py - (radius * g.w) / g.h) * g.h),
        y1 = Math.ceil((py + (radius * g.w) / g.h) * g.h);
      if (x0 < 1 || x1 >= g.w - 1 || y0 < 1 || y1 >= g.h - 1) continue;
      let safe = true;
      for (let yy = y0; yy <= y1 && safe; yy++)
        for (let xx = x0; xx <= x1; xx++)
          if (!g.data[yy * g.w + xx]) {
            safe = false;
            break;
          }
      if (safe)
        out.push({
          id,
          rank: hash,
          line: [
            [px - radius, py],
            [px + radius, py],
          ],
          region:
            py < y(10)
              ? 'upper'
              : Math.abs(px - cx) < fw * 0.45 && py < y(10) + fh * 0.45
                ? 'fringe'
                : 'side',
        });
    }
    const selected = [];
    for (const p of out.sort((a, b) => a.rank - b.rank)) {
      const px = (p.line[0][0] + p.line[1][0]) / 2,
        py = p.line[0][1];
      if (
        selected.some(
          (q) =>
            Math.hypot(
              px - (q.line[0][0] + q.line[1][0]) / 2,
              ((py - q.line[0][1]) * g.h) / g.w,
            ) <
            fw * 0.13,
        )
      )
        continue;
      selected.push(p);
      if (selected.length === 22) break;
    }
    return selected;
  }
  let latestHairGrid = null,
    latestHairTime = -Infinity;
  function hair(mask, face, details = false, timestamp = 0) {
    latestHairGrid = null;
    latestHairTime = timestamp;
    const empty = () => (details ? { lines: [], patches: [] } : []);
    if (!mask || !face || face.length < 468 * 3) return empty();
    const x = (i) => face[i * 3],
      y = (i) => face[i * 3 + 1],
      fw = Math.abs(x(234) - x(454)),
      cx = (x(234) + x(454)) / 2,
      fh = Math.abs(y(152) - y(10));
    if (fw < 0.04 || fh < 0.05) return empty();
    const g = component(grid(mask), [
      cx - fw * 0.6,
      y(10) - fh * 0.6,
      cx + fw * 0.6,
      y(10) + fh * 0.15,
    ]);
    latestHairGrid = g;
    const lines = top(
      g,
      [cx - fw * 1.05, y(10) - fh * 0.85, cx + fw * 1.05, y(152) + fh * 0.65],
      96,
    );
    return details ? { lines, patches: patches(g, face), hairGrid: g } : lines;
  }
  // Small local least-squares fits remove mask quantization BEFORE slope tests.
  // Runs remain separate: never bridge an occlusion or a missing mask region.
  function shoulderTops(lines, width, height, residualPixels = 2) {
    const out = [];
    for (const run of lines) {
      let part = [];
      for (let i = 0; i < run.length; i++) {
        const p = run[i],
          lo = Math.max(0, i - 3),
          hi = Math.min(run.length - 1, i + 3);
        let n = 0,
          sx = 0,
          sy = 0,
          sxx = 0,
          sxy = 0;
        for (let j = lo; j <= hi; j++) {
          const x = (run[j][0] - p[0]) * width,
            y = run[j][1] * height;
          n++;
          sx += x;
          sy += y;
          sxx += x * x;
          sxy += x * y;
        }
        const denom = n * sxx - sx * sx;
        const slope = denom > 1e-8 ? (n * sxy - sx * sy) / denom : Infinity;
        const fy = (sy - slope * sx) / n;
        if (
          n >= 3 &&
          Math.abs(slope) <= 0.6 &&
          Math.abs(fy - p[1] * height) <= residualPixels
        ) {
          part.push([p[0], fy / height]);
        } else {
          if (part.length > 1) out.push(part);
          part = [];
        }
      }
      if (part.length > 1) out.push(part);
    }
    return out;
  }
  function localTop(src, w, h, box, count = 24, upwardRange = 0) {
    const lines = [];
    let run = [];
    const ymin = Math.max(1, Math.floor(box[1] * h)),
      ymax = Math.min(h - 3, Math.ceil(box[3] * h));
    const xmin = Math.max(1, Math.ceil(box[0] * w)),
      xmax = Math.min(w - 2, Math.floor(box[2] * w));
    const step = Math.max(1, Math.ceil((xmax - xmin + 1) / count));
    const searchMin = Math.max(1, ymin - Math.ceil(upwardRange * h));
    for (let x = xmin; x <= xmax; x += step) {
      let hit = -1;
      for (let y = ymin; y <= ymax; y++)
        if (
          src[y * w + x] >= 0.65 &&
          src[(y + 1) * w + x] >= 0.65 &&
          src[(y + 2) * w + x] >= 0.65
        ) {
          hit = y;
          break;
        }
      if (hit === ymin && upwardRange > 0) {
        // Search for a real background-to-person transition, not the ROI border.
        hit = -1;
        for (let y = ymin; y > searchMin; y--)
          if (
            src[(y - 1) * w + x] < 0.65 &&
            src[y * w + x] >= 0.65 &&
            src[(y + 1) * w + x] >= 0.65 &&
            src[(y + 2) * w + x] >= 0.65
          ) {
            hit = y;
            break;
          }
      }
      if (
        hit <= searchMin ||
        (run.length && Math.abs(hit - run[run.length - 1][1] * h) > h * 0.035)
      ) {
        if (run.length > 1) lines.push(run);
        run = [];
      }
      if (hit > searchMin) run.push([(x + 0.5) / w, hit / h]);
    }
    if (run.length > 1) lines.push(run);
    return lines;
  }
  function shoulders(mask, pose, timestamp = 0, imageSize) {
    const out = { left: [], right: [] };
    root.ConfettiSurfaces.shoulderStats = {
      leftRaw: 0,
      rightRaw: 0,
      leftFit: 0,
      rightFit: 0,
      status: 'pose unavailable',
    };
    if (!mask || !pose || pose.length < 33) return out;
    const l = pose[11],
      r = pose[12],
      span = Math.hypot(l.x - r.x, l.y - r.y);
    if (span < 0.08) return out;
    if (!latestHairGrid || timestamp - latestHairTime > 250) {
      root.ConfettiSurfaces.shoulderStats.status = 'hair stale';
      return out;
    }
    const src = mask.getAsFloat32Array(),
      w = mask.width,
      h = mask.height,
      mid = (l.x + r.x) / 2;
    const imageW = imageSize?.width || w,
      imageH = imageSize?.height || h;
    const spanPixels = Math.hypot((l.x - r.x) * imageW, (l.y - r.y) * imageH);
    const spanX = spanPixels / imageW,
      spanY = spanPixels / imageH;
    root.ConfettiSurfaces.shoulderStats.imageAspect = imageW / imageH;
    root.ConfettiSurfaces.shoulderStats.status = 'fresh';
    for (const [key, si, ei] of [
      ['left', 11, 13],
      ['right', 12, 14],
    ]) {
      const s = pose[si],
        e = pose[ei];
      if (
        (s.visibility ?? 0) < 0.65 ||
        s.x < 0.02 ||
        s.x > 0.98 ||
        s.y < 0.02 ||
        s.y > 0.98
      ) {
        root.ConfettiSurfaces.shoulderStats[key + 'Reason'] = '关节不可见';
        continue;
      }
      // A cropped elbow near shoulder height is not proof that the arm is raised.
      if ((e.visibility ?? 0) > 0.75 && e.y < s.y - spanY * 0.08) {
        root.ConfettiSurfaces.shoulderStats[key + 'Reason'] = '手臂高于肩部';
        continue;
      }
      root.ConfettiSurfaces.shoulderStats[key + 'Reason'] = '正在提取';
      const side = Math.sign(s.x - mid),
        inner = mid + side * spanX * 0.2,
        outer = s.x - side * spanX * 0.015;
      out[key] = localTop(
        src,
        w,
        h,
        [
          Math.min(inner, outer),
          s.y - spanY * 0.22,
          Math.max(inner, outer),
          s.y + spanY * 0.16,
        ],
        24,
        spanY * 0.3,
      );
      root.ConfettiSurfaces.shoulderStats[key + 'Reason'] = out[key].length
        ? '有原始轮廓'
        : '搜索区无可靠边界';
      root.ConfettiSurfaces.shoulderStats[key + 'Raw'] = out[key].reduce(
        (n, r) => n + r.length,
        0,
      );
    }
    // Entry validation guarantees a fresh hair grid throughout this synchronous call.
    for (const key of ['left', 'right']) {
      const g = latestHairGrid,
        exposed = [];
      for (const run of out[key]) {
        let part = [];
        for (const p of run) {
          const x = Math.floor(p[0] * g.w),
            y = Math.floor(p[1] * g.h);
          let covered = false;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              if (
                xx >= 0 &&
                xx < g.w &&
                yy >= 0 &&
                yy < g.h &&
                g.data[yy * g.w + xx]
              )
                covered = true;
            }
          if (covered) {
            if (part.length > 1) exposed.push(part);
            part = [];
          } else part.push(p);
        }
        if (part.length > 1) exposed.push(part);
      }
      const fitted = shoulderTops(exposed, imageW, imageH, (2 * imageH) / h);
      out[key] = [];
      for (const run of fitted) {
        let supported = [];
        for (const p of run) {
          const x = Math.floor(p[0] * w),
            y = Math.ceil(p[1] * h) + 1;
          // Place the curve just inside the person; reject unsupported fits.
          if (
            y >= 0 &&
            y < h &&
            x >= 0 &&
            x < w &&
            src[y * w + x] >= 0.65 &&
            Math.abs(y - p[1] * h) <= 2
          ) {
            supported.push([p[0], p[1] + 1 / h]);
          } else {
            if (supported.length > 1) out[key].push(supported);
            supported = [];
          }
        }
        if (supported.length > 1) out[key].push(supported);
      }
      if (exposed.length && !out[key].length)
        root.ConfettiSurfaces.shoulderStats[key + 'Reason'] =
          '坡度或掩码不支持';
      else if (
        !exposed.length &&
        root.ConfettiSurfaces.shoulderStats[key + 'Raw']
      )
        root.ConfettiSurfaces.shoulderStats[key + 'Reason'] = '头发遮挡';
      root.ConfettiSurfaces.shoulderStats[key + 'Fit'] = out[key].reduce(
        (n, r) => n + r.length,
        0,
      );
    }
    return out;
  }
  root.ConfettiSurfaces = {
    grid,
    component,
    top,
    hair,
    patches,
    shoulderTops,
    localTop,
    shoulders,
  };
})(globalThis);
