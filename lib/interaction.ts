// Screen-space interaction prototype. No metric/shared camera depth is inferred.
export type Point = { x: number; y: number };
export type Hand = {
  id: string; tip: Point; wrist: Point; anchor: Point; span: number;
  heart: boolean; pointing: boolean; palm: boolean; reach: number;
};
export function coverPoint(x: number, y: number, width: number, height: number, sourceWidth: number, sourceHeight: number): Point {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  return { x: width - (x * sourceWidth * scale + (width - sourceWidth * scale) / 2), y: y * sourceHeight * scale + (height - sourceHeight * scale) / 2 };
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

export function readHand(raw: number[], id: string, width: number, height: number, sw: number, sh: number): Hand | null {
  if (raw.length !== 63 || !raw.every(Number.isFinite)) return null;
  const p = (i: number) => coverPoint(raw[i * 3], raw[i * 3 + 1], width, height, sw, sh);
  const wrist = p(0), span = distance(p(5), p(17));
  if (span < 18) return null;
  const extended = (tip: number, pip: number) => distance(p(tip), wrist) > distance(p(pip), wrist) * 1.16;
  const index = extended(8, 6), middle = extended(12, 10), ring = extended(16, 14), pinky = extended(20, 18);
  const tip = p(8), thumb = p(4);
  // A small crossed finger-heart uses thumb against the index distal segment.
  // A tip-to-tip pinch / OK ring is rejected; thresholds remain user-test candidates.
  const heart = !middle && !ring && !pinky && distance(thumb, p(7)) < span * .38
    && distance(thumb, tip) > span * .16 && distance(thumb, tip) < span * .65
    && distance(tip, wrist) > distance(p(5), wrist) * 1.1;
  const palm = [index, middle, ring, pinky].filter(Boolean).length >= 3;
  const tips = [p(8), p(12), p(16), p(20)];
  // Upper envelope of the open fingers is the visible support surface.
  const anchor = { x: tips.reduce((n, t) => n + t.x, 0) / 4, y: Math.min(...tips.map(t => t.y)) };
  return { id, tip: heart ? { x: (tip.x + thumb.x) / 2, y: (tip.y + thumb.y) / 2 } : tip, wrist, anchor, span,
    heart, palm, pointing: index && !middle && !ring && !pinky,
    reach: (raw[5 * 3 + 2] - raw[8 * 3 + 2]) / Math.max(.03, Math.hypot(raw[15] - raw[51], raw[16] - raw[52])) };
}

type HandMemory = { hand: Hand; seen: number; heartSince: number; emitted: number; dwell: Point; dwellSince: number; armed: boolean; offSince: number };
export type Heart = { active: boolean; x: number; y: number; age: number; owner: string; size: number };
export type Bubble = { active: boolean; x: number; y: number; vx: number; vy: number; r: number; age: number; pop: number;
  owner: string | null; lost: number; candidate: string | null; candidateSince: number; lastRelease: number };

export class Interaction {
  hearts: Heart[] = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, age: 0, owner: '', size: 0 }));
  bubbles: Bubble[] = Array.from({ length: 2 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, age: 0, pop: -1, owner: null, lost: 0, candidate: null, candidateSince: 0, lastRelease: -Infinity }));
  memories = new Map<string, HandMemory>();
  width = 640;
  height = 400;
  scene = 'hearts';
  hint = '把手放入画面';
  emittedHearts = 0;
  emittedBubbles = 0;
  popped = 0;
  reset(scene = this.scene) {
    this.scene = scene;
    this.memories.clear();
    this.hearts.forEach(h => { h.active = false; });
    this.bubbles.forEach(b => { b.active = false; b.owner = null; });
    this.hint = scene === 'hearts' ? '拇指交叉贴近食指，其他三指收起' : '伸出食指，停留片刻生成泡泡';
  }
  acceptHands(hands: Hand[], now: number) {
    for (const hand of hands) {
      let memory = this.memories.get(hand.id);
      if (!memory || now - memory.seen > 250) {
        memory = { hand, seen: now, heartSince: -1, emitted: -Infinity, dwell: hand.tip, dwellSince: now, armed: true, offSince: -1 };
        this.memories.set(hand.id, memory);
      }
      const previous = memory.hand;
      const sampleDt = Math.max(.016, (now - memory.seen) / 1000);
      const tipSpeed = distance(hand.tip, previous.tip) / sampleDt;
      if (this.scene === 'hearts') {
        if (hand.heart) {
          if (memory.heartSince < 0) memory.heartSince = now;
          if (now - memory.heartSince >= 180 && now - memory.emitted >= 1000) {
            const heart = this.hearts.find(h => !h.active);
            if (heart) { Object.assign(heart, { active: true, x: hand.tip.x, y: hand.tip.y - 10, age: 0, owner: hand.id, size: clamp(hand.span * .5, 25, 50) }); this.emittedHearts++; }
            memory.emitted = now;
          }
          this.hint = '爱心会从指尖飘走 · 保持比心可继续生成';
        } else memory.heartSince = -1;
      }
      if (this.scene === 'bubble') {
        // Poke requires a pointing fingertip entering an existing surface. Dwell is never a poke.
        for (const bubble of this.bubbles) {
          if (!bubble.active || bubble.pop >= 0 || bubble.age < .7 || bubble.owner === hand.id || !hand.pointing) continue;
          const before = distance(previous.tip, bubble), after = distance(hand.tip, bubble);
          const ax = previous.tip.x - bubble.x, ay = previous.tip.y - bubble.y;
          const dx = hand.tip.x - previous.tip.x, dy = hand.tip.y - previous.tip.y;
          const t = clamp(-(ax * dx + ay * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
          const swept = Math.hypot(ax + dx * t, ay + dy * t) <= bubble.r;
          const sidePoke = before > bubble.r + 3 && swept && tipSpeed > 65;
          // Local finger-depth change is only a conservative intent cue, not world-space depth.
          const forwardPoke = after < bubble.r * .75 && hand.reach - previous.reach > .2 && tipSpeed < 200;
          if (sidePoke || forwardPoke) { this.popBubble(bubble); this.hint = '戳破了！换一个位置可以再生成'; }
        }
        if (hand.pointing) {
          memory.offSince = -1;
          const moved = distance(hand.tip, memory.dwell);
          if (moved > Math.max(18, hand.span * .24)) {
            if (moved > Math.max(65, hand.span * .8)) memory.armed = true;
            memory.dwell = { ...hand.tip }; memory.dwellSince = now;
          }
          const near = this.bubbles.some(b => b.active && distance(hand.tip, b) < b.r * 1.8);
          if (memory.armed && !near && now - memory.dwellSince >= 650) {
            const bubble = this.bubbles.find(b => !b.active);
            if (bubble) {
              Object.assign(bubble, { active: true, x: hand.tip.x, y: hand.tip.y - 28, r: clamp(hand.span * .55, 28, 48), vx: 0, vy: -14, age: 0, pop: -1, owner: null, candidate: null, candidateSince: 0, lost: 0, lastRelease: -Infinity });
              this.emittedBubbles++; this.hint = '张开手掌，从泡泡下方慢慢靠近';
            }
            memory.armed = false;
          }
        } else {
          if (memory.offSince < 0) memory.offSince = now;
          if (now - memory.offSince > 300) { memory.armed = true; memory.dwell = hand.tip; memory.dwellSince = now; }
        }
      }
      memory.hand = hand; memory.seen = now;
    }
    for (const [id, memory] of this.memories) if (now - memory.seen > 350) this.memories.delete(id);
  }
  popBubble(bubble: Bubble) { if (bubble.pop < 0) { bubble.pop = 0; bubble.owner = null; this.popped++; } }
  step(dt: number, now: number) {
    dt = clamp(dt, 0, .04);
    for (const heart of this.hearts) {
      if (!heart.active) continue;
      heart.age += dt;
      const memory = this.memories.get(heart.owner);
      if (heart.age < .28 && memory && now - memory.seen < 200 && memory.hand.heart) {
        heart.x = memory.hand.tip.x; heart.y = memory.hand.tip.y - 10;
      } else { heart.y -= 55 * dt; heart.x += Math.sin(heart.age * 3) * 9 * dt; }
      if (heart.age > 2.6 || heart.y < -70) heart.active = false;
    }
    for (const bubble of this.bubbles) {
      if (!bubble.active) continue;
      bubble.age += dt;
      if (bubble.age >= 12) this.popBubble(bubble);
      if (bubble.pop >= 0) { bubble.pop += dt; if (bubble.pop >= .32) bubble.active = false; continue; }
      let support: Hand | null = null;
      if (bubble.owner) {
        const memory = this.memories.get(bubble.owner);
        if (memory && now - memory.seen < 180 && memory.hand.palm && distance(memory.hand.anchor, { x: bubble.x, y: bubble.y + bubble.r }) < bubble.r * 2) {
          support = memory.hand; bubble.lost = 0;
        } else {
          bubble.lost += dt;
          if (bubble.lost > .15) { bubble.owner = null; bubble.lastRelease = now; bubble.candidate = null; this.hint = '已释放 · 泡泡会轻轻上浮'; }
        }
      } else if (now - bubble.lastRelease > 300) {
        for (const memory of this.memories.values()) {
          const hand = memory.hand;
          const gap = hand.anchor.y - (bubble.y + bubble.r);
          // Narrow bottom contact window prevents attraction from the sides.
          if (now - memory.seen < 180 && hand.palm && Math.abs(hand.anchor.x - bubble.x) < bubble.r * .65 && gap >= -10 && gap < 16) {
            if (bubble.candidate !== hand.id) { bubble.candidate = hand.id; bubble.candidateSince = now; }
            if (now - bubble.candidateSince > 100) { bubble.owner = hand.id; support = hand; this.hint = '托住了 · 缓慢搬动，移开手即可释放'; }
            break;
          } else if (bubble.candidate === hand.id) bubble.candidate = null;
        }
      }
      if (support) {
        const tx = support.anchor.x, ty = support.anchor.y - bubble.r;
        // Damped spring: lag and inertia, never a hard snap to the palm.
        bubble.vx += ((tx - bubble.x) * 70 - bubble.vx * 15) * dt;
        bubble.vy += ((ty - bubble.y) * 70 - bubble.vy * 15) * dt;
      } else {
        bubble.vx += (Math.sin(bubble.age * 1.4) * 5 - bubble.vx * 1.2) * dt;
        bubble.vy += (-18 - bubble.vy * .9) * dt;
      }
      bubble.vx = clamp(bubble.vx, -230, 230); bubble.vy = clamp(bubble.vy, -230, 230);
      bubble.x += bubble.vx * dt; bubble.y += bubble.vy * dt;
      if (bubble.x < bubble.r) { bubble.x = bubble.r; bubble.vx = Math.abs(bubble.vx) * .3; }
      if (bubble.x > this.width - bubble.r) { bubble.x = this.width - bubble.r; bubble.vx = -Math.abs(bubble.vx) * .3; }
      if (bubble.y < bubble.r + 8) { bubble.y = bubble.r + 8; bubble.vy = Math.max(0, bubble.vy); }
    }
  }
  get count() { return this.hearts.filter(h => h.active).length + this.bubbles.filter(b => b.active).length; }
}
