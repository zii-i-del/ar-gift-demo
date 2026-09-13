import {mouthRegion} from './mouth-region.ts';
import {CONFETTI_CAPACITY, confettiCount, confettiDiameter, CONFETTI_SETTLED_WIDTH} from './confetti-config.ts';
import { STAR_POINTS } from './confetti-star.ts';
import { hairMotion, type HairGrid } from './hair-motion.ts';
import { coverPoint, cameraScale } from './coordinates.ts';
export type Point = { x: number; y: number };
export type Frame = Point & { scale: number; angle: number };
export type Surface = {
  id: 'hair' | 'frontHair' | 'left' | 'right';
  capacity?: number;
  patchIds?: number[];
  patchIndex?: Map<number, number>;
  frame: Frame;
  previous: Frame;
  segments: number[][];
  timestamp: number;
  poseTime: number;
  valid: boolean;
};
export type ConfettiPacket = {
  hairGrid?: HairGrid;
  diagnostics?: Record<string, string | number>;
  patches?: Array<{ id: number; line: number[][]; region: string }>;
  task: 'face' | 'hands' | 'hair' | 'pose';
  timestamp: number;
  duration: number;
  valid: boolean;
  error?: string;
  faceLandmarks?: number[] | null;
  hands?: number[][];
  lines?: number[][][] | { left: number[][][]; right: number[][][] };
  pose?: Array<{ x: number; y: number; visibility?: number }> | null;
};
export type Particle = {
  id: number;
  state: 0 | 1 | 2;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  flip: number;
  spin: number;
  w: number;
  h: number;
  color: number;
  front: boolean;
  alpha: number;
  surface: string;
  ax: number;
  ay: number;
  targetAngle: number;
  contactTime: number;
  fadeAt: number;
  patchId?: number;
  shoulderOnly?: boolean;
  aimedShoulder?: string;
  interior?: boolean;
  crownOnly?: boolean;
  backFace?: boolean;
  hairFixed?: boolean;
  settleFlip?: number;
  tiltAxis?: number;
  settleAxis?: number;
  landedWidth?: number;
  contactBaseX?: number;
  contactBaseY?: number;
  contactNormal?: number;
  plannedSurface?: string;
  flightUntil?: number;
  anchorRevision?: number;
  anchorX?: number;
  anchorY?: number;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function local(p: Point, f: Frame): Point {
  const c = Math.cos(f.angle),
    s = Math.sin(f.angle),
    x = p.x - f.x,
    y = p.y - f.y;
  return { x: (x * c + y * s) / f.scale, y: (-x * s + y * c) / f.scale };
}
export function world(p: Point, f: Frame): Point {
  const c = Math.cos(f.angle),
    s = Math.sin(f.angle);
  return {
    x: f.x + f.scale * (p.x * c - p.y * s),
    y: f.y + f.scale * (p.x * s + p.y * c),
  };
}
export function paperSupport(
  p: {
    w: number;
    h: number;
    angle: number;
    flip: number;
    state?: number;
    backFace?: boolean;
    tiltAxis?: number;
  },
  nx: number,
  ny: number,
) {
  const c = Math.cos(p.angle),
    s = Math.sin(p.angle);
  const projection =
    Math.max(0.12, Math.abs(Math.cos(p.flip))) *
    ((p.state === 1 ? Math.cos(p.flip) < 0 : p.backFace) ? -1 : 1);
  const ac = Math.cos(p.tiltAxis ?? 0),
    as = Math.sin(p.tiltAxis ?? 0);
  const xx = ac * ac + projection * as * as,
    xy = (1 - projection) * ac * as,
    yy = as * as + projection * ac * ac;
  const rx = nx * c + ny * s,
    ry = -nx * s + ny * c;
  const dx = rx * xx + ry * xy,
    dy = rx * xy + ry * yy,
    h = p.h;
  let support = -Infinity;
  for (const [x, y] of STAR_POINTS)
    support = Math.max(support, dx * x * p.w + dy * y * h);
  return support;
}
export function firstContact(
  from: Point,
  to: Point,
  s: Surface,
  paper: Parameters<typeof paperSupport>[0],
) {
  const a = local(from, s.previous),
    b = local(to, s.frame),
    scale = Math.min(s.frame.scale, s.previous.scale);
  let best: null | { t: number; x: number; y: number; angle: number } = null;
  for (const line of s.segments) {
    const [x, y, ex, ey] = line,
      dx = ex - x,
      dy = ey - y,
      len = Math.hypot(dx, dy);
    if (len < 1e-5) continue;
    const nx = dy / len,
      ny = -dx / len; // Segments are sorted left to right in the local frame.
    if (ny > -0.2) continue;
    const c = Math.cos(s.frame.angle),
      sn = Math.sin(s.frame.angle);
    const radius = paperSupport(paper, -(nx * c - ny * sn), -(nx * sn + ny * c)) / scale;
    const d0 = (a.x - x) * nx + (a.y - y) * ny,
      d1 = (b.x - x) * nx + (b.y - y) * ny;
    if (d0 < radius - 1e-5 || d1 >= d0 || d1 > radius) continue;
    const t = (d0 - radius) / (d0 - d1),
      hx = a.x + (b.x - a.x) * t,
      hy = a.y + (b.y - a.y) * t,
      u = ((hx - x) * dx + (hy - y) * dy) / (len * len);
    if (u < 0 || u > 1 || t < 0 || t > 1 || (best && t >= best.t)) continue;
    best = { t, x: hx, y: hy, angle: Math.atan2(dy, dx) };
  }
  return best;
}
export function coversMouth(
  face: number[] | null,
  hands: number[][],
  map: (x: number, y: number) => Point,
  mouthReference?: Point | null,
) {
  if (
    !face ||
    face.length < 468 * 3 ||
    hands.length !== 2 ||
    hands.some((h) => h.length !== 63)
  )
    return false;
  const p = (i: number) => map(face[i * 3], face[i * 3 + 1]),
    l = p(234),
    r = p(454),
    width = Math.hypot(l.x - r.x, l.y - r.y);
  if (width < 35) return false;
  const m1 = p(13),
    m2 = p(14),
    mouth = mouthReference ?? { x: (m1.x + m2.x) / 2, y: (m1.y + m2.y) / 2 },
    centers: Point[] = [];
  for (const h of hands) {
    const region=mouthRegion(h,map,mouth,width);
    if(region.state!=='covered')return false;
    centers.push(region);
  }
  return (
    Math.abs(centers[0].x - centers[1].x) > width * 0.12 &&
    Math.abs((centers[0].x + centers[1].x) / 2 - mouth.x) < width * 0.2
  );
}
export class Confetti {
  width = 640;
  height = 480;
  sourceW = 640;
  sourceH = 480;
  particles: Particle[] = Array.from({ length: CONFETTI_CAPACITY }, (_, id) => ({
    id,
    state: 0,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    flip: 0,
    spin: 0,
    w: 0,
    h: 0,
    color: 0,
    front: false,
    alpha: 0,
    surface: '',
    ax: 0,
    ay: 0,
    targetAngle: 0,
    contactTime: 0,
    fadeAt: -1,
  }));
  surfaces = new Map<string, Surface>();
  face: number[] | null = null;
  hands: number[][] = [];
  faceTime = 0;
  handsTime = 0;
  mouthOffset: Point | null = null;
  mouthOffsetTime = 0;
  snapshotAt = 0;
  debugSlow = false;
  rounds = 0;
  contacts = 0;
  frontHairEnabled = false;
  patchCandidates: NonNullable<ConfettiPacket['patches']> = [];
  patchTime = 0;
  hairPreparation: 'pending' | 'interior' | 'no-interior' = 'pending';
  private lastHairValid = false;
  hairGrid: HairGrid | null = null;
  hairGridTime = 0;
  usedPatches = new Set<number>();
  patchLaunches = new Map<number, number>();
  crownLaunches = 0;
  landed: Record<string, number> = {};
  shoulderDiagnostics: Record<string, string | number> = {};
  shoulderAnchors: Record<string, Point[]> = { left: [], right: [] };
  shoulderLaunches: Record<string, number> = { left: 0, right: 0 };
  shoulderLosses = 0;
  roundContacts = 0;
  modelReady = false;
  modelError = '';
  poseError = '';
  started = -1;
  candidate = -1;
  released = -1;
  rearming = false;
  armed = true;
  count = CONFETTI_CAPACITY;
  emitted = 0;
  accumulator = 0;
  seed = 103;
  frameTimes: number[] = [];
  p50 = 0;
  p95 = 0;
  lastStats = 0;
  metrics: Record<
    string,
    { timestamp: number; duration: number; valid: boolean }
  > = {};
  get playing() {
    return this.started >= 0;
  }
  get phase() {
    return this.playing
      ? this.rearming
        ? 'finishing'
        : 'playing'
      : this.candidate >= 0
        ? 'candidate'
        : 'idle';
  }
  get active() {
    let n = 0;
    for (const p of this.particles) if (p.state) n++;
    return n;
  }
  map = (x: number, y: number) =>
    coverPoint(x, y, this.width, this.height, this.sourceW, this.sourceH);
  frame(face: number[] | null): Frame | null {
    if (!face || face.length < 468 * 3) return null;
    const a = this.map(face[234 * 3], face[234 * 3 + 1]),
      b = this.map(face[454 * 3], face[454 * 3 + 1]);
    if (a.x > b.x) [a.x, b.x, a.y, b.y] = [b.x, a.x, b.y, a.y];
    const scale = Math.hypot(b.x - a.x, b.y - a.y);
    return scale > 30
      ? {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          scale,
          angle: Math.atan2(b.y - a.y, b.x - a.x),
        }
      : null;
  }
  resize(w: number, h: number, sw: number, sh: number) {
    if (
      w !== this.width ||
      h !== this.height ||
      sw !== this.sourceW ||
      sh !== this.sourceH
    ) {
      this.reset();
      this.surfaces.clear();
      this.hairGrid = null;
      this.hairGridTime = 0;
      this.patchCandidates = [];
      this.patchTime = 0;
    this.hairPreparation = 'pending';
    this.lastHairValid = false;
      this.face = null;
      this.hands = [];
    }
    this.width = w;
    this.height = h;
    this.sourceW = sw;
    this.sourceH = sh;
  }
  reset() {
    this.snapshotAt = 0;
    for (const p of this.particles) p.state = 0;
    this.started = -1;
    this.candidate = -1;
    this.released = -1;
    this.armed = true;
    this.accumulator = 0;
    this.emitted = 0;
  }
  invalidate() {
    this.reset();
    this.face = null;
    this.hands = [];
    this.faceTime = 0;
    this.handsTime = 0;
    this.surfaces.clear();
    this.hairGrid = null;
    this.hairGridTime = 0;
    this.patchCandidates = [];
    this.patchTime = 0;
    this.hairPreparation = 'pending';
    this.lastHairValid = false;
  }
  setSurface(
    id: Surface['id'],
    lines: number[][][],
    f: Frame | null,
    time: number,
  ) {
    const old = this.surfaces.get(id);
    if (!f || !lines.length) {
      if (old) {
        old.valid = false;
        if (
          f &&
          (id === 'left' || id === 'right') &&
          Math.hypot(f.x - old.frame.x, f.y - old.frame.y) < f.scale * 0.15
        ) {
          old.frame = f;
          old.poseTime = time;
        }
      }
      return;
    }
    const segs: number[][] = [];
    for (const run of lines) {
      const points = run
        .map((p) => local(this.map(p[0], p[1]), f))
        .sort((a, b) => a.x - b.x);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        if (b.x - a.x < 0.15) segs.push([a.x, a.y, b.x, b.y]);
      }
    }
    const stable =
      old &&
      time - old.poseTime < 400 &&
      Math.hypot(old.frame.x - f.x, old.frame.y - f.y) < f.scale * 0.4 &&
      Math.abs(old.frame.scale / f.scale - 1) < 0.25;
    if (stable && old.segments.length === segs.length)
      for (let i = 0; i < segs.length; i++)
        for (let j = 0; j < 4; j++)
          if (Math.abs(segs[i][j] - old.segments[i][j]) < 0.08)
            segs[i][j] = old.segments[i][j] * 0.4 + segs[i][j] * 0.6;
    // Recheck the final smoothed geometry in display pixels. Hair can use steep
    // contours; shoulders must face upward under screen-space gravity.
    if (id === 'left' || id === 'right')
      for (let i = segs.length - 1; i >= 0; i--) {
        const [x, y, ex, ey] = segs[i],
          a = world({ x, y }, f),
          b = world({ x: ex, y: ey }, f);
        if (Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 0.6) segs.splice(i, 1);
      }
    // Compute capacity only when a new contour arrives, using visible arc length.
    let visibleLength = 0;
    if (id === 'left' || id === 'right')
      for (const [x, y, ex, ey] of segs) {
        const a = world({ x, y }, f),
          b = world({ x: ex, y: ey }, f);
        if (a.y < 0 || b.y < 0 || a.y > this.height || b.y > this.height)
          continue;
        const dx = b.x - a.x;
        if (Math.abs(dx) < 1e-6) continue;
        const lo = Math.max(
          0,
          Math.min((0 - a.x) / dx, (this.width - a.x) / dx),
        );
        const hi = Math.min(
          1,
          Math.max((0 - a.x) / dx, (this.width - a.x) / dx),
        );
        visibleLength += Math.hypot(dx, b.y - a.y) * Math.max(0, hi - lo);
      }
    this.surfaces.set(id, {
      capacity: Math.min(
        12,
        Math.floor(visibleLength / (Math.min(this.width, this.height) * 0.035)),
      ),
      id,
      frame: f,
      previous: stable ? old.frame : f,
      segments: segs,
      timestamp: time,
      poseTime: time,
      valid: segs.length > 0,
    });
  }
  accept(r: ConfettiPacket, now: number) {
    if (r.error) {
      if (r.task === 'hair') {
        this.modelError = r.error;
        this.modelReady = false;
      }
      if (r.task === 'pose') this.poseError = r.error;
    } else if (r.task === 'hair') {
      this.modelError = '';
      this.modelReady = true;
    } else if (r.task === 'pose') this.poseError = '';
    this.metrics[r.task] = {
      timestamp: r.timestamp,
      duration: r.duration,
      valid: r.valid,
    };
    if (now - r.timestamp > 250) return;
    if (r.task === 'face') {
      this.face = r.valid ? (r.faceLandmarks ?? null) : null;
      this.faceTime = r.timestamp;
      const f = this.frame(this.face);
      for (const id of ['hair', 'frontHair']) {
        const s = this.surfaces.get(id);
        if (s) {
          if (f) {
            const jump =
              Math.hypot(f.x - s.frame.x, f.y - s.frame.y) > f.scale * 0.4 ||
              Math.abs(f.scale / s.frame.scale - 1) > 0.25;
            if (jump) s.valid = false;
            s.previous = s.frame;
            s.frame = f;
            s.poseTime = r.timestamp;
          } else s.valid = false;
        }
      }
    }
    if (r.task === 'hands') {
      this.hands = r.valid ? (r.hands ?? []) : [];
      this.handsTime = r.timestamp;
    }
    if (r.task === 'hair') {
      this.setSurface(
        'hair',
        r.valid ? (r.lines as number[][][]) : [],
        this.frame(r.faceLandmarks ?? this.face),
        r.timestamp,
      );
    }
    if (r.task === 'hair') {
      if (r.valid && r.hairGrid) {
        const prev = this.hairGrid,
          next = r.hairGrid;
        if (prev && r.timestamp - this.hairGridTime <= 400) {
          const scale = cameraScale(this.width, this.height, this.sourceW, this.sourceH);
          const sw = this.sourceW * scale,
            sh = this.sourceH * scale;
          for (const p of this.particles)
            if (p.state === 2 && p.hairFixed) {
              const x = 1 - (p.x + (sw - this.width) / 2) / sw,
                y = (p.y + (sh - this.height) / 2) / sh;
              const delta = hairMotion(prev, next, x, y);
              p.x -= delta.x * sw;
              p.y += delta.y * sh;
            }
        }
        this.hairGrid = next;
        this.hairGridTime = r.timestamp;
      }
      const candidates = r.valid ? (r.patches ?? []) : [];
      const previous = new Set(this.patchCandidates.map((p) => p.id));
      const stable =
        this.lastHairValid && r.timestamp > this.patchTime && r.timestamp - this.patchTime <= 650
          ? candidates.filter((p) => previous.has(p.id))
          : [];
      const consecutive = this.lastHairValid && r.valid && !r.error && r.timestamp > this.patchTime && r.timestamp - this.patchTime <= 650;
      this.hairPreparation = consecutive && stable.length ? 'interior'
        : consecutive && !candidates.length && !this.patchCandidates.length ? 'no-interior' : 'pending';
      this.lastHairValid = r.valid && !r.error;
      this.patchCandidates = candidates;
      this.patchTime = r.timestamp;
      this.setSurface(
        'frontHair',
        stable.map((p) => p.line),
        this.frame(r.faceLandmarks ?? this.face),
        r.timestamp,
      );
      const front = this.surfaces.get('frontHair');
      if (front) {
        front.patchIds = stable.map((p) => p.id);
        front.patchIndex = new Map(stable.map((p, i) => [p.id, i]));
      }
    }
    if (r.task === 'pose') {
      this.shoulderDiagnostics = r.diagnostics ?? {};
      const pose = r.pose,
        lines = r.lines as
          | { left: number[][][]; right: number[][][] }
          | undefined;
      if (!r.valid || !pose || !lines) {
        for (const id of ['left', 'right']) {
          const s = this.surfaces.get(id);
          if (s) s.valid = false;
        }
        return;
      }
      const l = this.map(pose[11].x, pose[11].y),
        rr = this.map(pose[12].x, pose[12].y),
        left = l.x < rr.x ? l : rr,
        right = l.x < rr.x ? rr : l,
        scale = Math.hypot(right.x - left.x, right.y - left.y),
        angle = Math.atan2(right.y - left.y, right.x - left.x);
      for (const [id, p] of [
        ['left', l],
        ['right', rr],
      ] as const)
        this.setSurface(
          id,
          lines[id],
          scale > 40 ? { ...p, scale, angle } : null,
          r.timestamp,
        );
    }
  }
  trigger(now: number, count?: number) {
    if (this.playing || !this.modelReady) return false;
    this.started = now;
    this.rounds++;
    this.debugSlow = count === 20;
    this.frontHairEnabled = true;
    this.landed = {};
    this.shoulderLaunches = { left: 0, right: 0 };
    this.shoulderLosses = 0;
    this.roundContacts = 0;
    this.shoulderAnchors = { left: [], right: [] };
    this.usedPatches.clear();
    this.patchLaunches.clear();
    this.crownLaunches = 0;
    this.count = count ?? confettiCount(this.height > this.width);
    this.emitted = 0;
    this.armed = false;
    this.rearming = false;
    this.candidate = -1;
    this.released = -1;
    return true;
  }
  mouthReference(now: number): Point | null {
    const face = this.face,
      f = this.frame(face);
    if (!face || !f) return null;
    const nose = this.map(face[1 * 3], face[1 * 3 + 1]);
    const lips = this.map(
      (face[13 * 3] + face[14 * 3]) / 2,
      (face[13 * 3 + 1] + face[14 * 3 + 1]) / 2,
    );
    const offset = {
      x: (lips.x - nose.x) / f.scale,
      y: (lips.y - nose.y) / f.scale,
    };
    const credible =
      Math.abs(offset.x) < 0.3 && offset.y > 0.06 && offset.y < 0.5;
    if (credible) {
      if (!coversMouth(face, this.hands, this.map)) {
        this.mouthOffset = offset;
        this.mouthOffsetTime = now;
      }
      return lips;
    }
    if (this.mouthOffset && now - this.mouthOffsetTime <= 250)
      return {
        x: nose.x + this.mouthOffset.x * f.scale,
        y: nose.y + this.mouthOffset.y * f.scale,
      };
    return null;
  }
  externalGestures = false;
  gesture(now: number) {
    if(this.externalGestures)return;
    this.rearming =
      this.playing &&
      (now - this.started) * (this.debugSlow ? 0.25 : 1) >= 5500;
    if (this.playing && !this.rearming) return;
    if (now - this.faceTime > 250 || now - this.handsTime > 250) {
      this.candidate = -1;
      this.released = -1;
      return;
    }
    const covered = coversMouth(
      this.face,
      this.hands,
      this.map,
      this.mouthReference(now),
    );
    if (!this.armed) {
      if (!covered) {
        if (this.released < 0) this.released = this.handsTime;
        if (this.handsTime - this.released >= 300) this.armed = true;
      } else this.released = -1;
      return;
    }
    if (covered) {
      if (this.candidate < 0) this.candidate = now;
      if (now - this.candidate >= 300 && !this.playing) this.trigger(now);
    } else this.candidate = -1;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  spawn(i: number, now = this.started) {
    const p = this.particles[i];
    const unit = Math.min(this.width, this.height);
    Object.assign(p, {
      state: 1,
      x: this.random() * this.width,
      y: -10 - this.random() * unit * 0.06,
      vx: (this.random() - 0.5) * unit * 0.14,
      vy: unit * (0.13 + this.random() * 0.18),
      w: unit * 3.3 * (0.012 + this.random() * 0.012),
      h: unit * 3.3 * (0.007 + this.random() * 0.01),
      angle: this.random() * Math.PI * 2,
      flip: this.random() * Math.PI * 2,
      spin: (i % 2 ? 1 : -1) * (1.2 + this.random() * 3.2),
      color: i % 4,
      backFace: false,
      hairFixed: false,
      settleFlip: undefined,
      tiltAxis: 0,
      settleAxis: 0,
      landedWidth: undefined,
      contactBaseX: undefined,
      contactBaseY: undefined,
      contactNormal: undefined,
      front: i % 5 === 0,
      alpha: 1,
      surface: '',
      fadeAt: -1,
    });
    // Preserve visual size relative to framing height when switching to portrait.
    // Motion still uses the short edge; only the paper dimensions change.
    const diameter =
      confettiDiameter(this.height, this.height > this.width, i, this.random());
    p.w = diameter;
    p.h = diameter;
    p.interior = false;
    p.patchId = undefined;
    p.shoulderOnly = false;
    p.crownOnly = false;
    p.aimedShoulder = undefined;
    p.plannedSurface = undefined;
    p.flightUntil = undefined;
    // Keep at least half of all emissions free and distributed across the screen.
    if (this.frontHairEnabled && !p.front && i % 2 === 1) {
      const inFlight: Record<string, number> = {};
      const reserved = new Set<number>();
      for (const q of this.particles) {
        if (
          q !== p &&
          q.state === 1 &&
          q.plannedSurface &&
          now < (q.flightUntil ?? 0)
        ) {
          inFlight[q.plannedSurface] = (inFlight[q.plannedSurface] ?? 0) + 1;
          if (q.patchId !== undefined) reserved.add(q.patchId);
        }
      }
      let choice:
        | { s: Surface; point: Point; patch?: number; score: number }
        | undefined;
      for (const s of this.surfaces.values()) {
        if (!s.valid || now - s.timestamp > 250 || now - s.poseTime > 250)
          continue;
        const quota =
          s.id === 'hair'
            ? 3
            : s.id === 'frontHair'
              ? Math.min(16, s.patchIds?.length ?? 0)
              : Math.min(6, s.capacity ?? 0);
        const filled = (this.landed[s.id] ?? 0) + (inFlight[s.id] ?? 0);
        if (!quota || filled >= quota) continue;
        let points: { point: Point; patch?: number }[] = [];
        let top = Infinity;
        if (s.id === 'hair')
          for (const [x, y, ex, ey] of s.segments)
            top = Math.min(
              top,
              world({ x, y }, s.frame).y,
              world({ x: ex, y: ey }, s.frame).y,
            );
        for (let j = 0; j < s.segments.length; j++) {
          const [x, y, ex, ey] = s.segments[j];
          const a = world({ x, y }, s.frame),
            b = world({ x: ex, y: ey }, s.frame);
          const fraction =
            s.id === 'left' || s.id === 'right'
              ? 0.15 +
                0.7 *
                  (((this.shoulderLaunches[s.id] ?? 0) * 0.61803398875 + 0.5) %
                    1)
              : 0.5;
          const point = {
            x: a.x + (b.x - a.x) * fraction,
            y: a.y + (b.y - a.y) * fraction,
          };
          if (
            point.x < 0 ||
            point.x > this.width ||
            point.y < 0 ||
            point.y > this.height
          )
            continue;
          const patch = s.patchIds?.[j];
          if (
            s.id === 'frontHair' &&
            (patch === undefined ||
              this.usedPatches.has(patch) ||
              reserved.has(patch))
          )
            continue;
          if (
            s.id === 'hair' &&
            (point.y > top + s.frame.scale * 0.16 ||
              Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 0.8)
          )
            continue;
          points.push({ point, patch });
        }
        if (!points.length) continue;
        // Spread hair opportunities over image-left and image-right before repeats.
        if (s.id === 'frontHair') {
          const mid = s.frame.x;
          const slots = [0, 0],
            attempts = [0, 0];
          for (let j = 0; j < s.segments.length; j++) {
            const [x, y, ex, ey] = s.segments[j];
            const side =
              world({ x: (x + ex) / 2, y: (y + ey) / 2 }, s.frame).x < mid
                ? 0
                : 1;
            slots[side]++;
            attempts[side] +=
              this.patchLaunches.get(s.patchIds?.[j] ?? -1) ?? 0;
          }
          points.sort((a, b) => {
            const sa = a.point.x < mid ? 0 : 1,
              sb = b.point.x < mid ? 0 : 1;
            return (
              attempts[sa] / Math.max(1, slots[sa]) -
                attempts[sb] / Math.max(1, slots[sb]) ||
              (this.patchLaunches.get(a.patch!) ?? 0) -
                (this.patchLaunches.get(b.patch!) ?? 0) ||
              a.point.x - b.point.x
            );
          });
        }
        const launch =
          s.id === 'hair'
            ? this.crownLaunches
            : s.id === 'frontHair'
              ? 0
              : (this.shoulderLaunches[s.id] ?? 0);
        const candidate =
          points[
            s.id === 'frontHair'
              ? 0
              : Math.floor(((0.5 + launch * 0.61803398875) % 1) * points.length)
          ];
        const score = 1 - filled / quota;
        if (!choice || score > choice.score)
          choice = { s, ...candidate, score };
      }
      if (choice) {
        const { s, point, patch } = choice;
        // Predict the same fixed-step gravity/drag once at launch, never home in flight.
        const dt = 1 / 60,
          drag = Math.exp(-0.4 * dt);
        let y = p.y,
          vy = p.vy,
          steps = 0;
        while (y + p.h * 0.5 < point.y && steps < 300) {
          vy = Math.min(this.height * 0.45, vy + this.height * 0.2 * dt);
          y += vy * dt;
          steps++;
        }
        const travel = (dt * drag * (1 - Math.pow(drag, steps))) / (1 - drag);
        const offset =
          (this.random() - 0.5) *
          Math.min(this.width * 0.6, travel * this.width * 0.5);
        p.x = clamp(point.x + offset, 0, this.width);
        p.vx = (point.x - p.x) / Math.max(dt, travel);
        p.plannedSurface = s.id;
        p.flightUntil = now + (steps + 6) * dt * 1000;
        p.patchId = patch;
        p.interior = s.id === 'frontHair';
        p.crownOnly = s.id === 'hair';
        p.shoulderOnly = s.id === 'left' || s.id === 'right';
        if (p.interior)
          this.patchLaunches.set(
            patch!,
            (this.patchLaunches.get(patch!) ?? 0) + 1,
          );
        if (p.crownOnly) this.crownLaunches++;
        if (p.shoulderOnly) {
          p.aimedShoulder = s.id;
          this.shoulderLaunches[s.id]++;
        }
      }
    }
    p.px = p.x;
    p.py = p.y;
  }
  step(dt: number, now: number) {
    if (!this.playing) return;
    const age = ((now - this.started) / 1000) * (this.debugSlow ? 0.25 : 1);
    if (age >= 7) {
      for (const p of this.particles) p.state = 0;
      this.started = -1;
      this.rearming = false;
      return;
    }
    const target = Math.min(
      this.count,
      Math.floor((Math.min(2, age) / 2) * this.count),
    );
    while (this.emitted < target) this.spawn(this.emitted++, now);
    for (const p of this.particles) {
      if (!p.state) continue;
      p.px = p.x;
      p.py = p.y;
      if (p.state === 1) {
        if (p.plannedSurface) {
          const target = this.surfaces.get(p.plannedSurface);
          const limit =
            p.plannedSurface === 'hair'
              ? 3
              : p.plannedSurface === 'frontHair'
                ? 16
                : Math.min(6, target?.capacity ?? 6);
          if (
            (this.landed[p.plannedSurface] ?? 0) >= limit ||
            now > (p.flightUntil ?? Infinity)
          ) {
            p.plannedSurface = undefined;
            p.flightUntil = undefined;
            p.interior = false;
            p.crownOnly = false;
            p.shoulderOnly = false;
            p.front = true;
          }
        }
        if (p.interior) {
          const f = this.surfaces.get('frontHair'),
            index = f?.patchIndex?.get(p.patchId!) ?? -1;
          const line = index >= 0 ? f?.segments[index] : undefined;
          if (
            this.usedPatches.has(p.patchId!) ||
            (f?.valid &&
              now - f.timestamp <= 250 &&
              line &&
              p.y - p.h >
                world({ x: (line[0] + line[2]) / 2, y: line[1] }, f.frame).y)
          ) {
            p.interior = false;
            p.shoulderOnly = true;
          }
        }
        p.vx *= Math.exp(-0.4 * dt);
        p.vx +=
          Math.sin(age * 2 + p.id) *
          this.width *
          (p.plannedSurface
            ? 0
            : p.interior || p.shoulderOnly || p.crownOnly
              ? 0.004
              : 0.04) *
          dt;
        p.vy = Math.min(this.height * 0.45, p.vy + this.height * 0.2 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += dt * (p.id % 3 === 0 ? -1 : 1) * (4 + (p.id % 7) * 0.65);
        if (!p.front && age < 6) {
          let best: null | {
            s: Surface;
            hit: NonNullable<ReturnType<typeof firstContact>>;
          } = null;
          for (const s of this.surfaces.values()) {
            if (
              s.id === 'frontHair' &&
              (!p.interior || p.patchId === undefined)
            )
              continue;
            if (p.interior && s.id !== 'frontHair') continue;
            if (p.crownOnly && s.id !== 'hair') continue;
            const shoulder = s.id === 'left' || s.id === 'right';
            if (p.shoulderOnly && !shoulder) continue;
            if (this.roundContacts >= 32) continue;
            if (
              shoulder &&
              (this.landed.left ?? 0) + (this.landed.right ?? 0) >= 12
            )
              continue;
            if (
              this.frontHairEnabled &&
              (this.landed[s.id] ?? 0) >=
                (s.id === 'hair'
                  ? 3
                  : s.id === 'frontHair'
                    ? 16
                    : Math.min(6, s.capacity ?? 0))
            )
              continue;
            if (!s.valid || now - s.timestamp > 250 || now - s.poseTime > 250)
              continue;
            let contactSurface = s;
            if (s.id === 'frontHair') {
              const index = s.patchIndex?.get(p.patchId!) ?? -1;
              if (index < 0 || this.usedPatches.has(p.patchId!)) continue;
              contactSurface = { ...s, segments: [s.segments[index]] };
            }
            const hit = firstContact(
              { x: p.px, y: p.py },
              p,
              contactSurface,
              p,
            );
            if (
              hit &&
              shoulder &&
              this.shoulderAnchors[s.id].some(
                (a) =>
                  Math.hypot(a.x - hit.x, a.y - hit.y) * s.frame.scale <
                  Math.max(
                    Math.min(this.width, this.height) * 0.035,
                    p.w * 1.1,
                  ),
              )
            )
              continue;
            if (hit && s.id === 'frontHair') {
              const q = world({ x: hit.x, y: hit.y }, s.frame);
              if (
                this.particles.some(
                  (other) =>
                    other.state === 2 &&
                    other.surface === 'frontHair' &&
                    Math.hypot(other.x - q.x, other.y - q.y) <
                      (other.w + p.w) * 0.42,
                )
              )
                continue;
            }
            if (hit && (!best || hit.t < best.hit.t)) best = { s, hit };
          }
          if (best) {
            this.contacts++;
            this.roundContacts++;
            if (best.s.id === 'left' || best.s.id === 'right')
              this.shoulderAnchors[best.s.id].push({
                x: best.hit.x,
                y: best.hit.y,
              });
            if (best.s.id === 'frontHair') this.usedPatches.add(p.patchId!);
            this.landed[best.s.id] = (this.landed[best.s.id] ?? 0) + 1;
            p.backFace = Math.cos(p.flip) < 0;
            p.state = 2;
            p.surface = best.s.id;
            p.hairFixed = best.s.id === 'frontHair';
            p.ax = best.hit.x;
            p.ay = best.hit.y;
            const variation = ((p.id * 73 + 29) % 101) / 100;
            if (p.hairFixed) {
              // Keep the arrival direction; a small fixed offset avoids upright rows.
              p.targetAngle = p.angle + (variation - 0.5) * 0.5;
              p.settleFlip = Math.acos(
                p.id % 5 === 0
                  ? 0.3 + variation * 0.15
                  : p.id % 3 === 0
                    ? 0.85 + variation * 0.12
                    : 0.5 + variation * 0.25,
              );
              p.settleAxis = (((p.id * 47 + 11) % 97) / 96 - 0.5) * Math.PI;
            } else {
              p.targetAngle = best.hit.angle + (variation - 0.5) * 0.24;
              p.settleFlip = Math.acos(0.38 + variation * 0.14);
              p.landedWidth = p.w * CONFETTI_SETTLED_WIDTH;
              p.contactNormal = best.hit.angle;
              const angle = best.hit.angle + best.s.frame.angle;
              const support = paperSupport(
                p,
                -Math.sin(angle),
                Math.cos(angle),
              );
              p.contactBaseX =
                p.ax -
                (Math.sin(best.hit.angle) * support) / best.s.frame.scale;
              p.contactBaseY =
                p.ay +
                (Math.cos(best.hit.angle) * support) / best.s.frame.scale;
            }
            // Equivalent visible thickness, without turning through extra revolutions.
            p.flip = Math.acos(Math.max(0.12, Math.abs(Math.cos(p.flip))));
            p.contactTime = now;
            p.anchorRevision = best.s.timestamp;
            p.anchorX = p.ax;
            p.anchorY = p.ay;
            const hit = world({ x: p.ax, y: p.ay }, best.s.frame);
            p.x = hit.x;
            p.y = hit.y;
          }
        }
        if (
          p.y - p.h > this.height ||
          p.x + p.w < 0 ||
          p.x - p.w > this.width
        ) {
          p.state = 0;
          continue;
        }
      } else if (p.fadeAt < 0) {
        const s = this.surfaces.get(p.surface);
        // Established landings survive missing masks and pose. Only fresh pose moves
        // their original local anchor; otherwise hold the last screen position.
        p.tiltAxis =
          (p.tiltAxis ?? 0) +
          ((p.settleAxis ?? 0) - (p.tiltAxis ?? 0)) * Math.min(1, dt / 0.05);
        if (p.landedWidth !== undefined)
          p.w += (p.landedWidth - p.w) * Math.min(1, dt / 0.05);
        p.flip += ((p.settleFlip ?? 0) - p.flip) * Math.min(1, dt / 0.05);
        if (p.hairFixed) {
          p.angle +=
            Math.atan2(
              Math.sin(p.targetAngle - p.angle),
              Math.cos(p.targetAngle - p.angle),
            ) * Math.min(1, dt / 0.05);
        } else if (s && now - s.poseTime <= 250) {
          const a = p.targetAngle + s.frame.angle;
          p.angle +=
            Math.atan2(Math.sin(a - p.angle), Math.cos(a - p.angle)) *
            Math.min(1, dt / 0.05);
          if (
            p.contactBaseX !== undefined &&
            p.contactBaseY !== undefined &&
            p.contactNormal !== undefined
          ) {
            const theta = p.contactNormal + s.frame.angle;
            const support =
              paperSupport(p, -Math.sin(theta), Math.cos(theta)) /
              s.frame.scale;
            p.ax = p.contactBaseX + Math.sin(p.contactNormal) * support;
            p.ay = p.contactBaseY - Math.cos(p.contactNormal) * support;
          }
          const q = world({ x: p.ax, y: p.ay }, s.frame);
          p.x = q.x;
          p.y = q.y;
        }
      }
      p.alpha = Math.min(
        1,
        7 - age,
        p.fadeAt >= 0 ? Math.max(0, 1 - (now - p.fadeAt) / 300) : 1,
      );
      if (p.alpha <= 0) p.state = 0;
    }
    for (const s of this.surfaces.values()) s.previous = { ...s.frame };
  }
  update(dtMs: number, now: number, sampleFrames = false) {
    if (this.snapshotAt && now >= this.snapshotAt) return;
    this.gesture(now);
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      this.accumulator = 0;
      return;
    }
    const speed = this.debugSlow ? 0.25 : 1;
    this.accumulator = Math.min(0.05, this.accumulator + (dtMs / 1000) * speed);
    while (this.accumulator >= 1 / 60) {
      this.step(
        1 / 60,
        now - (this.accumulator * 1000) / speed + 1000 / 60 / speed,
      );
      this.accumulator -= 1 / 60;
    }
    if (!sampleFrames) {
      this.frameTimes.length = 0;
      this.p50 = this.p95 = this.lastStats = 0;
      return;
    }
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
    if (now - this.lastStats > 500 && this.frameTimes.length >= 30) {
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      this.p50 = sorted[Math.floor(sorted.length * 0.5)];
      this.p95 = sorted[Math.floor(sorted.length * 0.95)];
      this.lastStats = now;
    }
  }
  hint(now: number) {
    if (this.modelError) return '识别模型加载失败，请重试';
    if (!this.modelReady) return '正在准备头发和肩膀识别…';
    if (this.playing) return '彩带落下后，会停留在头发和肩膀上';
    if (!this.armed) return '双手离开嘴部片刻，再捂嘴触发';
    if (this.candidate >= 0) return '保持捂嘴片刻…';
    if (
      this.poseError ||
      !['left', 'right'].some((id) => {
        const s = this.surfaces.get(id);
        return s?.valid && now - s.timestamp < 800;
      })
    )
      return '双手捂嘴触发 · 肩膀暂不可见，仅支持头发停留';
    return '双手捂嘴，保持片刻';
  }
}
