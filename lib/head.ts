import { respondContact } from './contact.ts';
import { coverPoint } from './coordinates.ts';
export type HeadState = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  angle: number;
  timestamp: number;
  vx: number;
  vy: number;
  omega: number;
  reset: boolean;
};
const limit = (v: number, m: number) => Math.max(-m, Math.min(m, v));
export function readHead(
  raw: number[] | null,
  w: number,
  h: number,
  sw: number,
  sh: number,
  time: number,
  old: HeadState | null,
): HeadState | null {
  if (!raw || raw.length < 468 * 3 || !raw.every(Number.isFinite) || !sw || !sh)
    return null;
  const p = (i: number) => coverPoint(raw[3 * i], raw[3 * i + 1], w, h, sw, sh);
  const l = p(234),
    r = p(454),
    f = p(10),
    chin = p(152);
  const dx = chin.x - f.x,
    dy = chin.y - f.y,
    len = Math.hypot(dx, dy);
  if (len < 35) return null;
  const next: HeadState = {
    x: f.x + dx * 0.38,
    y: f.y + dy * 0.38,
    rx: Math.hypot(l.x - r.x, l.y - r.y) * 0.57,
    ry: len * 0.66,
    angle: Math.atan2(dy, dx) - Math.PI / 2,
    timestamp: time,
    vx: 0,
    vy: 0,
    omega: 0,
    reset: true,
  };
  if (next.rx < 15) return null;
  if (
    old &&
    time > old.timestamp &&
    time - old.timestamp < 200 &&
    Math.hypot(next.x - old.x, next.y - old.y) < len * 0.6 &&
    Math.abs(next.rx / old.rx - 1) < 0.3 &&
    Math.abs(next.ry / old.ry - 1) < 0.3 &&
    Math.abs(
      Math.atan2(
        Math.sin(next.angle - old.angle),
        Math.cos(next.angle - old.angle),
      ),
    ) < 0.8
  ) {
    const dt = (time - old.timestamp) / 1000,
      alpha = 1 - Math.exp(-dt * 22);
    const da = Math.atan2(
      Math.sin(next.angle - old.angle),
      Math.cos(next.angle - old.angle),
    );
    next.x = old.x + (next.x - old.x) * alpha;
    next.y = old.y + (next.y - old.y) * alpha;
    next.rx = old.rx + (next.rx - old.rx) * alpha;
    next.ry = old.ry + (next.ry - old.ry) * alpha;
    next.angle = old.angle + da * alpha;
    next.vx = limit((next.x - old.x) / dt, 350);
    next.vy = limit((next.y - old.y) / dt, 350);
    next.omega = limit((da * alpha) / dt, 2);
    next.reset = false;
  }
  return next;
}
export type ContactBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  squash?: number;
  squashAmount?: number;
  hitAngle?: number;
  contactX?: number;
  contactY?: number;
};
// Shared scratch output; simulation is synchronous, no per-bubble allocations.
const surface = { x: 0, y: 0, nx: 0, ny: 0, distance: 0 };
function ellipseSurface(x: number, y: number, rx: number, ry: number) {
  const ax = Math.abs(x),
    ay = Math.abs(y),
    outside = (x / rx) ** 2 + (y / ry) ** 2 >= 1;
  let ex: number, ey: number;
  if (outside) {
    let lo = 0,
      hi = Math.max(rx, ry) * Math.hypot(x, y);
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (
        ((rx * ax) / (m + rx * rx)) ** 2 + ((ry * ay) / (m + ry * ry)) ** 2 >
        1
      )
        lo = m;
      else hi = m;
    }
    const t = (lo + hi) / 2;
    ex = (rx * rx * ax) / (t + rx * rx);
    ey = (ry * ry * ay) / (t + ry * ry);
  } else {
    // An interior point can have several stationary points. Find the nearest basin.
    let best = Infinity,
      angle = 0;
    for (let i = 0; i <= 16; i++) {
      const a = (i * Math.PI) / 32,
        d = (rx * Math.cos(a) - ax) ** 2 + (ry * Math.sin(a) - ay) ** 2;
      if (d < best) {
        best = d;
        angle = a;
      }
    }
    let lo = Math.max(0, angle - Math.PI / 32),
      hi = Math.min(Math.PI / 2, angle + Math.PI / 32);
    for (let i = 0; i < 20; i++) {
      const a = lo + (hi - lo) / 3,
        b = hi - (hi - lo) / 3;
      if (
        (rx * Math.cos(a) - ax) ** 2 + (ry * Math.sin(a) - ay) ** 2 <
        (rx * Math.cos(b) - ax) ** 2 + (ry * Math.sin(b) - ay) ** 2
      )
        hi = b;
      else lo = a;
    }
    ex = rx * Math.cos((lo + hi) / 2);
    ey = ry * Math.sin((lo + hi) / 2);
  }
  ex *= x < 0 ? -1 : 1;
  ey *= y < 0 ? -1 : 1;
  const n = Math.hypot(ex / (rx * rx), ey / (ry * ry));
  surface.x = ex;
  surface.y = ey;
  surface.nx = ex / (rx * rx) / n;
  surface.ny = ey / (ry * ry) / n;
  surface.distance = Math.hypot(x - ex, y - ey) * (outside ? 1 : -1);
}
export function collideHead(
  b: ContactBody,
  px: number,
  py: number,
  h: HeadState,
  dt: number,
  now: number,
  w: number,
  height: number,
  previousRadius: number = b.r,
) {
  if (now - h.timestamp > 200 || now < h.timestamp || dt <= 0) return;
  // Limit prediction; never keep injecting velocity after the extrapolation stops.
  const age = Math.max(0, Math.min(0.1, (now - h.timestamp) / 1000));
  const hvx = age < 0.1 ? h.vx : 0,
    hvy = age < 0.1 ? h.vy : 0,
    omega = age < 0.1 ? h.omega : 0;
  const hx = h.x + h.vx * age,
    hy = h.y + h.vy * age,
    angle = h.angle + h.omega * age;
  const dx = b.x - px,
    dy = b.y - py;
  const travel =
    Math.hypot(dx - hvx * dt, dy - hvy * dt) +
    Math.abs(omega * dt) * Math.max(h.rx, h.ry);
  if (
    Math.hypot(px - (hx - hvx * dt), py - (hy - hvy * dt)) >
    Math.max(h.rx, h.ry) + b.r + travel
  )
    return;
  let t = 0,
    c = 1,
    s = 0,
    cx = 0,
    cy = 0;
  let hit = false;
  let growthContact = false;
  // Conservative advancement of a circle against the actual ellipse offset,
  // including head translation and rotation, rather than enlarged ellipse axes.
  for (let i = 0; i < 32; i++) {
    const a = angle - omega * dt * (1 - t);
    c = Math.cos(a);
    s = Math.sin(a);
    cx = hx - hvx * dt * (1 - t);
    cy = hy - hvy * dt * (1 - t);
    const x = px + dx * t - cx,
      y = py + dy * t - cy;
    ellipseSurface(c * x + s * y, -s * x + c * y, h.rx, h.ry);
    const gap = surface.distance - b.r;
    if (gap <= 0.05) {
      growthContact = t===0 && surface.distance>previousRadius+.05;
      hit = true;
      break;
    }
    if (travel < 1e-8) return;
    t += Math.max(0.00001, (gap / travel) * 0.9);
    if (t > 1) return;
  }
  if (!hit) return;
  const nx = c * surface.nx - s * surface.ny,
    ny = s * surface.nx + c * surface.ny;
  // Move the contact surface to the end of the step for nonpenetration.
  const ec = Math.cos(angle),
    es = Math.sin(angle);
  const enx = ec * surface.nx - es * surface.ny,
    eny = es * surface.nx + ec * surface.ny;
  const contactX = hx + ec * surface.x - es * surface.y,
    contactY = hy + es * surface.x + ec * surface.y;
  const x = contactX + enx * (b.r + 0.1),
    y = contactY + eny * (b.r + 0.1);
  b.x = x;
  b.y = y;
  // Viewport takes precedence when there is no room between head and wall.
  if (
    x < b.r ||
    x > w - b.r ||
    y < b.r + 8 ||
    y > height - b.r - 8 ||
    b.age < 0.1 ||
    h.reset || growthContact
  )
    return;
  const cvx = hvx - omega * (contactY - hy),
    cvy = hvy + omega * (contactX - hx);
  if(!respondContact(b,nx,ny,cvx,cvy))return;
  b.contactX = contactX;
  b.contactY = contactY;
}
