export const AUTO_HEART_INTERVAL_MS=350;
import {PrimaryEmitter, type EmitterCandidate} from './primary-emitter.ts';
import {gunPose3D,type GunPose3D} from './gun-pose.ts';
import {BUBBLE_CAPACITY,BUBBLE_INTERVAL,BUBBLE_LIFETIME,bubbleTargetRadius,bubbleRadius} from './bubble-stream.ts';
import { heartAppearanceAngle } from './heart-presentation.ts';
import { fingerEmitter, heartBirthOffset, heartBirthSize, HEART_CAPACITY, HEART_LIFETIME } from './heart-flow.ts';
import { collideHead, type HeadState } from './head.ts';
import { collideHeart } from './heart-response.ts';
import {collideLiteHeart,stepHeartTurn,HeartPetalPool} from './heart-lightweight.ts';
// Screen-space interaction prototype. No metric/shared camera depth is inferred.
export type Point = { x: number; y: number };
export type Hand = {
  landmarks?: number[];
  id: string; tip: Point; wrist: Point; anchor: Point; span: number;
  heartOrigin?: Point; heartDirection?: Point | null;
  gun?: boolean; gunUncertain?: boolean; gunPose?:GunPose3D; gunReason?: string; indexBends?: [number,number]; gunDirection?: Point; heart: boolean; heartPossible?: boolean; pointing: boolean; palm: boolean; reach: number;
};
import { coverPoint } from './coordinates.ts';
export { coverPoint } from './coordinates.ts';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const segmentsCross = (a: Point,b: Point,c: Point,d: Point) => cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0;

// Distance to an actual finger segment, not its root-to-tip shortcut.
const pointSegmentDistance = (p: Point, a: Point, b: Point) => {
  const dx=b.x-a.x, dy=b.y-a.y;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};

export function readHand(raw: number[], id: string, width: number, height: number, sw: number, sh: number, world?:number[]|null): Hand | null {
  if (raw.length !== 63 || !raw.every(Number.isFinite)) return null;
  const p = (i: number) => coverPoint(raw[i * 3], raw[i * 3 + 1], width, height, sw, sh);
  const wrist = p(0), span = distance(p(5), p(17));
  if (span < 18) return null;
  const extended = (tip: number, pip: number) => distance(p(tip), wrist) > distance(p(pip), wrist) * 1.08;
  const index = extended(8, 6), middle = extended(12, 10), ring = extended(16, 14), pinky = extended(20, 18);
  const tip = p(8), thumb = p(4);
  // A small crossed finger-heart uses thumb against the index distal segment.
  // A tip-to-tip pinch / OK ring is rejected; thresholds remain user-test candidates.
  const indexReach = distance(tip, wrist) / Math.max(1, distance(p(5), wrist));
  const thumbIndex = distance(thumb, tip) / span;
  const segmentDistance = (() => { const a=p(6), b=p(8), dx=b.x-a.x, dy=b.y-a.y; const t=Math.max(0,Math.min(1,((thumb.x-a.x)*dx+(thumb.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy))); return distance(thumb,{x:a.x+dx*t,y:a.y+dy*t})/span; })();
  const crossed = segmentsCross(p(2), thumb, p(5), tip) || segmentsCross(p(1), thumb, p(5), p(8));
  // A bent/occluded index need not be farther from the wrist than its PIP.
  const ix=tip.x-p(6).x, iy=tip.y-p(6).y;
  const tx=thumb.x-p(3).x, ty=thumb.y-p(3).y;
  const angleSine=Math.abs(ix*ty-iy*tx)/Math.max(1,Math.hypot(ix,iy)*Math.hypot(tx,ty));
  const foldedCount=[middle,ring,pinky].filter(v=>!v).length;
  const separated=thumbIndex>.3 && thumbIndex<1.8;
  const thumbJoint=p(3), indexJoint=p(6);
  const emitter=fingerEmitter(p(3),thumb,p(6),tip,{x:(p(5).x+p(17).x+wrist.x)/3,y:(p(5).y+p(17).y+wrist.y)/3},p(7));
  // Both tips must protrude beyond the contact: proximity alone also matches pinches.
  // Screen-space landmark evidence, not a pixel-visibility measurement.
  const exposedTips=emitter.thumbBeyond>=Math.max(span*.22,emitter.thumbLength*.25)
    && emitter.indexBeyond>=Math.max(span*.22,emitter.indexLength*.25);
  const distalContact=segmentsCross(thumbJoint,thumb,indexJoint,tip)
    || Math.min(pointSegmentDistance(thumbJoint,indexJoint,tip),pointSegmentDistance(thumb,indexJoint,tip),
      pointSegmentDistance(indexJoint,thumbJoint,thumb),pointSegmentDistance(tip,thumbJoint,thumb))<span*.18;
  const crossEvidence=exposedTips && distalContact && angleSine>.35 && separated && indexReach>1.05;
  // Distinguish a thumb resting across the index base from a distal finger-heart.
  const base=p(5), pip=p(6);
  const axisX=tip.x-base.x, axisY=tip.y-base.y;
  const axisLength2=Math.max(1,axisX*axisX+axisY*axisY);
  const thumbProgress=((thumb.x-base.x)*axisX+(thumb.y-base.y)*axisY)/axisLength2;
  const indexChain=distance(base,pip)+distance(pip,p(7))+distance(p(7),tip);
  const clearIndex=distance(base,tip)/Math.max(1,indexChain)>.88
    && distance(base,tip)>span*.7 && thumbProgress<.42 && thumbIndex>.65;
  const heart = !clearIndex && foldedCount>=2 && crossEvidence && distance(thumb,p(2))>span*.45;
  const heartPossible = exposedTips && distalContact && !clearIndex && separated && foldedCount>=2 && angleSine>.25 && (crossed || segmentDistance<.65) && indexReach>.85;
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;
  // Require the actual index chain to be straight, not merely far from the wrist.
  const jointCosine = (a: Point, b: Point, c: Point) => {
    const ux=b.x-a.x, uy=b.y-a.y, vx=c.x-b.x, vy=c.y-b.y;
    return (ux*vx+uy*vy)/Math.max(1,Math.hypot(ux,uy)*Math.hypot(vx,vy));
  };
  const indexStraight = jointCosine(p(5),p(6),p(7))>.65 && jointCosine(p(6),p(7),tip)>.65;
  const thumbRaised = distance(thumb,wrist)>distance(p(5),wrist)*1.12
    && distance(thumb,p(2))>span*.6;
  const pointing = index && indexStraight && foldedCount === 3
    && (clearIndex || !thumbRaised) && !heart && !heartPossible;
  const thumbBase=p(2), thumbKnuckle=p(3);
  const indexCos1=jointCosine(base,pip,p(7)),indexCos2=jointCosine(pip,p(7),tip);
  const indexRatio=distance(base,tip)/Math.max(1,indexChain);
  const thumbSpread=pointSegmentDistance(thumb,base,tip)/span;
  // A narrow gun silhouette is valid: thumb extension matters more than a wide L angle.
  const palmX=base.x-wrist.x,palmY=base.y-wrist.y,palmLength=Math.max(1,Math.hypot(palmX,palmY));
  const thumbForward=((thumb.x-base.x)*palmX+(thumb.y-base.y)*palmY)/palmLength;
  const thumbLateral=Math.abs((thumb.x-base.x)*palmY-(thumb.y-base.y)*palmX)/palmLength;
  const thumbOutside=thumbForward>span*.12 || thumbLateral>span*.65;
  const distalCross=segmentsCross(thumbKnuckle,thumb,pip,tip);
  // Use palm length rather than palm width: side views can collapse palm width.
  const gunForward=((tip.x-base.x)*palmX+(tip.y-base.y)*palmY)/(palmLength*palmLength);
  const gunSeparation=distance(thumb,tip)/palmLength;
  // Screen evidence only supports the 3D soft band when the whole visible chain agrees.
  const bend1=Math.acos(clamp(indexCos1,-1,1))*180/Math.PI;
  const bend2=Math.acos(clamp(indexCos2,-1,1))*180/Math.PI;
  const projectedStraight=indexRatio>.99 && Math.max(bend1,bend2)<15 && gunForward>.7 && gunSeparation>.6;
  const pose=gunPose3D(world,projectedStraight);
  // Keep the visible hook veto; separate perspective-sensitive distance gates.
  const gunReason=Math.max(bend1,bend2)>45 || indexRatio<.88 ? '二维食指明确弯曲'
    : Math.max(bend1,bend2)>25 ? '二维食指伸直证据不足'
    : indexRatio<.97 ? '食指整体伸展证据不足'
    : pose.state!=='valid' ? pose.reason
    : gunForward<.5 ? '食指朝向投影不足'
    : gunSeparation<.48 ? '拇食指分离证据不足'
    : distance(base,tip)<=span*.35 ? '食指投影过短'
    : distance(thumb,thumbBase)<=span*.35 ? '拇指投影过短'
    : thumbSpread<=.12 ? '拇指离食指距离不足'
    : !thumbOutside ? '拇指未伸出掌部'
    : thumbIndex<=.28 ? '两指尖距离不足'
    : distalCross || heart || heartPossible ? '两指交叉或比心'
    : '标准发射手势';
  const gunUncertain=!/明确弯曲|交叉|比心|仍伸出|未伸出/.test(gunReason) && (pose.state==='uncertain' || /不足|过短/.test(gunReason));
  const gun=gunReason==='标准发射手势';
  const indexBends:[number,number]=[Math.acos(clamp(indexCos1,-1,1))*180/Math.PI,Math.acos(clamp(indexCos2,-1,1))*180/Math.PI];
  const gunLength=Math.hypot(ix,iy);
  const gunDirection={x:ix/Math.max(1,gunLength),y:iy/Math.max(1,gunLength)};
  const palm = !gun && !heart && !pointing && (extendedCount >= 2 || distance(p(4), p(20)) > span * 1.1);
  const tips = [p(8), p(12), p(16), p(20)];
  // Upper envelope of the open fingers is the visible support surface.
  const anchor = { x: tips.reduce((n, t) => n + t.x, 0) / 4, y: Math.min(...tips.map(t => t.y)) };
  return { id, landmarks:raw, tip, heartOrigin:emitter.origin, heartDirection:emitter.direction, wrist, anchor, span,
    gun,gunUncertain,gunPose:pose,gunReason,indexBends,gunDirection,heart, heartPossible, palm, pointing,
    reach: (raw[5 * 3 + 2] - raw[8 * 3 + 2]) / Math.max(.03, Math.hypot(raw[15] - raw[51], raw[16] - raw[52])) };
}

type HandMemory = { hand: Hand; seen: number; heartSince: number; heartConfirmed: boolean; emitted: number; gunSince:number; gunGap:number; gunResets:number; gunLastReject:string; gx:number;gy:number;gdx:number;gdy:number; gunSequence:number; lastBubble: number; offSince: number; vx: number; vy: number; lastHeart: number; palmBody: HeadState|null; ox:number;oy:number;dx:number;dy:number;ovx:number;ovy:number;directionSeen:number; heartSequence:number };
export type Heart = { active: boolean; x: number; y: number; age: number; owner: string; size: number; vx?:number;vy?:number;angle?:number; emitterAngle?:number; spreadAngle?:number; appearanceAngle?:number; birthOrder?:number; colorOrder?:number; contactAge?:number; squashAmount?:number; hitAngle?:number; motesReleased?:boolean; motionAngle?:number;angularVelocity?:number;contactBody?:string;contactReleased?:boolean };
export type Bubble = { active: boolean; x: number; y: number; vx: number; vy: number; r: number; age: number; pop: number;
  driftPhase?:number;driftRate?:number;driftSpeed?:number;riseSpeed?:number;targetR?:number;birthOrder?:number;launchAngle?:number; squash?: number; squashAmount?:number; hitAngle?: number; contactX?: number; contactY?: number; };

export class Interaction {
  readonly heartPetals:HeartPetalPool|null;
  lightweightHearts:boolean;
  constructor(lightweightHearts=false){this.lightweightHearts=lightweightHearts;this.heartPetals=lightweightHearts?new HeartPetalPool():null;}
  hearts: Heart[] = Array.from({ length: HEART_CAPACITY }, () => ({ active: false, x: 0, y: 0, age: 0, owner: '', size: 0 }));
  heartTails: Heart[] = Array.from({ length: HEART_CAPACITY }, () => ({active:false,x:0,y:0,age:0,owner:'',size:0}));
  bubbles: Bubble[] = Array.from({ length: BUBBLE_CAPACITY }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, age: 0, pop: -1 }));
  memories = new Map<string, HandMemory>();
  head: HeadState | null = null;
  acceptHead(head: HeadState | null) { this.head=head; }
  width = 640;
  height = 400;
  scene = 'hearts';
  primaryEmitter=new PrimaryEmitter();
  private autoSuspended=false;
  autoLow=false;
  autoConfetti=false;
  autoBlocked=false;
  autoReady={hearts:true,bubble:true};
  lastSharedHeart=-Infinity;
  lastSharedBubble=-Infinity;
  lastHeartOwner='';
  lastBubbleOwner='';
  dropped={hearts:0,bubble:0};
  private lastHandSample=-Infinity;

  hint = '把手放入画面';
  emittedHearts = 0;
  emittedBubbles = 0;
  popped = 0;
  reset(scene = this.scene) {
    this.scene = scene;
    this.primaryEmitter.reset();this.autoSuspended=false;
    this.lastHandSample=-Infinity;this.lastSharedHeart=this.lastSharedBubble=-Infinity;this.lastHeartOwner=this.lastBubbleOwner="";
    this.memories.clear();
    this.head=null;
    this.hearts.forEach(h => { h.active = false; });
    this.heartTails.forEach(h => { h.active = false; });
    this.heartPetals?.reset();
    this.bubbles.forEach(b => { b.active = false; });
    this.hint = scene === 'hearts' ? '拇指交叉贴近食指，其他三指收起' : '拇指、食指伸直张开，其余三指收拢';
  }
  acceptHands(hands: Hand[], now: number) {
    if(this.scene==='auto'){
      if(now<=this.lastHandSample)return;
      this.lastHandSample=now;
      hands=[...hands].sort((a,b)=>(a.id===this.lastHeartOwner?1:0)-(b.id===this.lastHeartOwner?1:0)||a.id.localeCompare(b.id));
    }
    // A completed inference with no matching hand is stronger than an expired sample.
    for(const [id,memory] of this.memories)if(!hands.some(hand=>hand.id===id)){memory.gunSince=-1;memory.heartSince=-1;memory.heartConfirmed=false;}
    if(this.scene==='bubble')this.hint=hands.length===0
      ? '未识别到手，请将手掌和手腕一起移入画面'
      : hands.some(hand=>hand.gun) ? '保持手势，指尖连续发射泡泡'
      : '发射手势未确认：请保持食指伸直、拇指张开，并让手指轮廓清楚可见';
    for (const hand of hands) {
      let memory = this.memories.get(hand.id);
      if (!memory || now - memory.seen > (this.scene==='auto'?200:250)) {
        memory = { hand, seen: now, heartSince: -1, heartConfirmed: false, emitted: -Infinity, gunSince:-1,gunGap:-1,gunResets:0,gunLastReject:"",gx:hand.tip.x,gy:hand.tip.y,gdx:0,gdy:-1,gunSequence:0, lastBubble: -Infinity, offSince: -1, vx: 0, vy: 0, lastHeart: -Infinity, palmBody:null,ox:hand.heartOrigin?.x ?? hand.tip.x,oy:hand.heartOrigin?.y ?? hand.tip.y,dx:0,dy:-1,ovx:0,ovy:0,directionSeen:-Infinity,heartSequence:0 };
        this.memories.set(hand.id, memory);
      }
      const previous = memory.hand;
      const sampleDt = Math.max(.016, (now - memory.seen) / 1000);

      const origin=hand.heartOrigin ?? hand.tip;
      const alpha=1-Math.exp(-sampleDt*25),oldX=memory.ox,oldY=memory.oy;
      memory.ox+=(origin.x-memory.ox)*alpha;memory.oy+=(origin.y-memory.oy)*alpha;
      memory.ovx=clamp((memory.ox-oldX)/sampleDt,-320,320);memory.ovy=clamp((memory.oy-oldY)/sampleDt,-320,320);
      const direction=hand.heartDirection;
      if(direction && Math.hypot(direction.x,direction.y)>.1){
        let angle=Math.atan2(memory.dy,memory.dx);const target=Math.atan2(direction.y,direction.x);
        angle+=Math.atan2(Math.sin(target-angle),Math.cos(target-angle))*(memory.directionSeen===-Infinity?1:alpha);
        memory.dx=Math.cos(angle);memory.dy=Math.sin(angle);memory.directionSeen=now;
      }
      if(hand.palm){
        const prior=memory.palmBody,reset=!prior || now-memory.seen>200 || distance(hand.anchor,previous.anchor)>hand.span*2;
        memory.palmBody={x:hand.anchor.x,y:hand.anchor.y,rx:hand.span*.28,ry:hand.span*.28,angle:0,timestamp:now,
          vx:reset?0:clamp((hand.anchor.x-previous.anchor.x)/sampleDt,-350,350),vy:reset?0:clamp((hand.anchor.y-previous.anchor.y)/sampleDt,-350,350),omega:0,reset};
      }else memory.palmBody=null;
      if (this.scene === 'hearts' || this.scene==='auto') {
        if (hand.heart) memory.lastHeart=now;
        const accepted=this.scene==='auto' ? hand.heart && !hand.gun && !this.autoBlocked && this.autoReady.hearts : hand.heart || (memory.heartConfirmed && hand.heartPossible === true && now-memory.lastHeart<220);
        if (accepted && now-memory.directionSeen<=200) {
          if (memory.heartSince < 0) memory.heartSince = now;
          if (hand.heart && now - memory.heartSince >= 100) memory.heartConfirmed=true;
          if(this.scene!=='auto'&&memory.heartConfirmed&&now-memory.emitted>=350)this.emitHeart(memory,now);
          this.hint = '爱心会从指尖飘走 · 保持比心可继续生成';
        } else { memory.heartSince = -1; memory.heartConfirmed=false; }
      }
      if(this.scene==='auto'&&(!hand.gun||!this.autoReady.bubble||this.autoBlocked)){memory.gunSince=-1;memory.gunGap=-1;}
      const wasGunSince=memory.gunSince;
      if(!hand.gun)memory.gunLastReject=hand.gunReason ?? '追踪未确认';
      if (hand.gun && hand.gunDirection && !hand.heart && !hand.heartPossible && (this.scene!=='auto'||(this.autoReady.bubble&&!this.autoBlocked))) {
        if(memory.gunGap>=0 && now-memory.gunGap>150)memory.gunSince=-1;
        memory.gunGap=-1;
        if(memory.gunSince<0){
          memory.gunSince=now;memory.gx=hand.tip.x;memory.gy=hand.tip.y;
          memory.gdx=hand.gunDirection.x;memory.gdy=hand.gunDirection.y;
        } else {
          memory.gx+=(hand.tip.x-memory.gx)*alpha;memory.gy+=(hand.tip.y-memory.gy)*alpha;
          const old=Math.atan2(memory.gdy,memory.gdx),target=Math.atan2(hand.gunDirection.y,hand.gunDirection.x);
          const angle=old+Math.atan2(Math.sin(target-old),Math.cos(target-old))*alpha;
          memory.gdx=Math.cos(angle);memory.gdy=Math.sin(angle);
        }
      }else {
        // Suspend births on every uncertain sample; retain only an already-confirmed identity.
        if(hand.gunUncertain && !hand.heart && !hand.heartPossible && memory.gunSince>=0 && now-memory.gunSince>=250){
          if(memory.gunGap<0)memory.gunGap=now;
          if(now-memory.gunGap>150)memory.gunSince=-1;
        }else {memory.gunSince=-1;memory.gunGap=-1;}
      }
      if(wasGunSince>=0 && memory.gunSince<0)memory.gunResets++;
      memory.vx = clamp((hand.tip.x - previous.tip.x) / sampleDt, -320, 320);
      memory.vy = clamp((hand.tip.y - previous.tip.y) / sampleDt, -320, 320);
      memory.hand = hand; memory.seen = now;
    }
    if(this.scene==='auto'){
      if(this.autoBlocked)this.suspendAuto();
      else {
        this.autoSuspended=false;
        const candidates:EmitterCandidate[]=hands.map(hand=>{
          const m=this.memories.get(hand.id)!;
          const kind=hand.heart&&!hand.gun&&this.autoReady.hearts?'hearts':hand.gun&&!hand.heart&&!hand.heartPossible&&this.autoReady.bubble?'bubble':'';
          return {id:hand.id,kind,confirmed:kind==='hearts'?m.heartConfirmed:kind==='bubble'&&m.gunSince>=0&&now-m.gunSince>=250};
        });
        this.primaryEmitter.update(candidates,now);
      }
    }
    for (const [id, memory] of this.memories) if (now - memory.seen > 350) this.memories.delete(id);
  }
  private suspendAuto(){
    if(this.autoSuspended)return;
    this.autoSuspended=true;this.primaryEmitter.reset();
    for(const m of this.memories.values()){m.heartSince=-1;m.heartConfirmed=false;m.gunSince=-1;m.gunGap=-1;}
  }
  private emitHeart(memory:HandMemory,now:number){
    const hand=memory.hand,auto=this.scene==='auto';
    const limit=auto?(this.autoConfetti?(this.autoLow?6:8):(this.autoLow?8:12)):HEART_CAPACITY;
    let active=0,owned=0;let heart:Heart|undefined;
    for(const h of this.hearts){if(h.active){active++;if(h.owner===hand.id)owned++;}else if(!heart)heart=h;}
    if(active>=limit||(!auto&&owned>=6))heart=undefined;
    // A full pool consumes this opportunity; it never creates a deferred burst.
    memory.emitted=now;if(auto)this.lastSharedHeart=now;
    if(!heart){this.dropped.hearts++;return;}
    const scatter=heartBirthOffset(memory.heartSequence),emitterAngle=Math.atan2(memory.dy,memory.dx),angle=emitterAngle+scatter;
    const inherited=Math.hypot(memory.ovx,memory.ovy)*.25,inheritScale=inherited>40?40/inherited:.999999;
    const prediction=Math.min(.08,12/Math.max(1,Math.hypot(memory.ovx,memory.ovy)));
    Object.assign(heart,{active:true,x:memory.ox+memory.ovx*prediction,y:memory.oy+memory.ovy*prediction,age:0,owner:hand.id,
      vx:Math.cos(angle)*80+memory.ovx*.25*inheritScale,vy:Math.sin(angle)*80+memory.ovy*.25*inheritScale,angle:angle+Math.PI/2,emitterAngle,spreadAngle:scatter,appearanceAngle:heartAppearanceAngle(emitterAngle,scatter),birthOrder:this.emittedHearts,
      colorOrder:memory.heartSequence,size:heartBirthSize(this.width,this.height,this.emittedHearts),contactAge:undefined,squashAmount:0,hitAngle:0,motesReleased:false,motionAngle:0,angularVelocity:0,contactBody:undefined,contactReleased:true});
    this.emittedHearts++;memory.heartSequence++;if(auto)this.lastHeartOwner=hand.id;
  }
  popBubble(bubble: Bubble) { if (bubble.pop < 0) { bubble.pop = 0; this.popped++; } }
  step(dt: number, now: number) {
    const portrait = this.height > this.width;
    if(this.scene==='auto'&&this.autoBlocked)this.suspendAuto();
    const primary=this.scene==='auto'&&!this.autoBlocked?this.primaryEmitter.select(now):undefined;
    if(primary?.kind==='hearts'&&this.autoReady.hearts){
      const m=this.memories.get(primary.id);
      if(m&&m.heartConfirmed&&now-m.seen<=200&&now-m.directionSeen<=200&&now-this.lastSharedHeart>=AUTO_HEART_INTERVAL_MS)this.emitHeart(m,now);
    }
    // Birth clock runs at physics rate, independent of 15 Hz landmark arrivals.
    const bubbleMemories=this.memories.values();
    if(this.scene==='bubble'||this.scene==='auto')for(const memory of bubbleMemories){
      if(this.scene==='auto'){
        if(primary?.kind!=='bubble'||primary.id!==memory.hand.id)continue;
        const interval=portrait?(this.autoLow?240:180)+((this.emittedBubbles*.61803398875)%1)*40:(this.autoLow?180:125);
        if(this.autoBlocked||!this.autoReady.bubble||now-this.lastSharedBubble<interval||memory.hand.heart||memory.hand.heartPossible)continue;
        const limit=this.autoConfetti?(this.autoLow?12:20):(this.autoLow?20:32);
        if(this.bubbles.filter(b=>b.active).length>=limit){this.lastSharedBubble=now;this.dropped.bubble++;continue;}
      }
      if(!memory.hand.gun || memory.gunSince<0 || now-memory.seen>200 || now-memory.gunSince<250 || (this.scene!=='auto'&&now-memory.lastBubble<(portrait ? 180 + ((memory.gunSequence * .61803398875) % 1) * 40 : BUBBLE_INTERVAL)))continue;
      memory.lastBubble=now; // Never catch up a backlog after a stall.
      const bubble=this.bubbles.find(b=>!b.active);
      if(!bubble){
        if(this.scene==='auto'){this.dropped.bubble++;continue;}
        let oldest:Bubble|undefined;
        for(const b of this.bubbles)if(b.pop<0 && (!oldest || b.age>oldest.age))oldest=b;
        if(oldest)this.popBubble(oldest);
        continue;
      }
      const sequence=memory.gunSequence++,targetR=bubbleTargetRadius(memory.hand.span,sequence)*(this.width>this.height?1.1290752:1);
      const r=bubbleRadius(targetR,0),scatter=(portrait ? (((this.emittedBubbles * .61803398875) % 1) * 2 - 1) * 25 : [-6,3,-2,6,0][sequence%5])*Math.PI/180;
      const angle=Math.atan2(memory.gdy,memory.gdx)+scatter;
      const speed=110+(sequence%3)*10;
      const prediction=Math.min(.06,8/Math.max(1,Math.hypot(memory.vx,memory.vy)));
      Object.assign(bubble,{active:true,x:clamp(memory.gx+memory.vx*prediction+memory.gdx*(r+3),r,this.width-r),
        y:clamp(memory.gy+memory.vy*prediction+memory.gdy*(r+3),r+8,this.height-r-8),
        vx:Math.cos(angle)*speed+memory.vx*.08,vy:Math.sin(angle)*speed+memory.vy*.08,
        driftPhase: (this.emittedBubbles * 2.39996323) % (Math.PI*2),
        driftRate: 1.1 + (this.emittedBubbles * .41421356 % 1) * .8,
        driftSpeed: this.width * (.045 + (this.emittedBubbles * .7320508 % 1) * .035),
        riseSpeed: this.height * (.13 + .07 * (1-Math.min(1,targetR/36))),
        r,targetR,age:0,pop:-1,squash:0,squashAmount:0,hitAngle:angle,launchAngle:angle,birthOrder:++this.emittedBubbles});
      if(this.scene==='auto'){this.lastSharedBubble=now;this.lastBubbleOwner=memory.hand.id;}
      this.hint='拇指、食指伸直，其余三指收拢 · 张开手掌可拨动泡泡';
    }
    const heartElapsed = Math.max(0, dt);
    dt = clamp(dt, 0, .04);
    this.heartPetals?.step(heartElapsed);
    for(const tail of this.heartTails)if(tail.active){tail.age+=heartElapsed;tail.x+=(tail.vx??0)*dt*.2;tail.y-=8*dt;if(tail.age>=HEART_LIFETIME+.27)tail.active=false;}
    for (const heart of this.hearts) {
      if (!heart.active) continue;
      const px=heart.x,py=heart.y;
      heart.age += heartElapsed;
      const memory = this.memories.get(heart.owner);
      if (heart.age < .1 && memory && now-memory.seen<200 && memory.hand.heart) {
        const prediction=Math.min(.08,12/Math.max(1,Math.hypot(memory.ovx,memory.ovy)));
        heart.x=memory.ox+memory.ovx*prediction;heart.y=memory.oy+memory.ovy*prediction;
      }else{
        heart.vy=(heart.vy ?? 0)-12*dt;
        if(this.lightweightHearts)stepHeartTurn(heart,dt);
        if(!this.lightweightHearts&&heart.contactAge!==undefined&&heart.age-heart.contactAge>.18){
          heart.vx=(heart.vx??0)*Math.exp(-1.1*dt);
          heart.vy+=(-65-heart.vy)*(1-Math.exp(-3*dt));
        }
        heart.x+=(heart.vx ?? 0)*dt;heart.y+=(heart.vy ?? 0)*dt;
      }
      for(const m of this.memories.values())if(m.palmBody && m.hand.palm && now-m.seen<=160 && (m.hand.id!==heart.owner || heart.age>.7))
        this.lightweightHearts?collideLiteHeart(heart,px,py,m.palmBody,dt,now,this.width,this.height,m.hand.id):collideHeart(heart,px,py,m.palmBody,dt,now,this.width,this.height);
      if(this.width>this.height && this.head)this.lightweightHearts?collideLiteHeart(heart,px,py,this.head,dt,now,this.width,this.height,'face'):collideHeart(heart,px,py,this.head,dt,now,this.width,this.height);
      if(!heart.motesReleased && heart.age>=HEART_LIFETIME-.15){
        if(this.heartPetals){this.heartPetals.spawn(heart);heart.motesReleased=true;}
        else{const tail=this.heartTails.find(t=>!t.active);
          if(tail){Object.assign(tail,heart,{active:true});heart.motesReleased=true;}}
      }
      if(heart.age>=HEART_LIFETIME)heart.active=false;
    }
    if(this.head && now-this.head.timestamp>200)this.head=null;
    for (const bubble of this.bubbles) {
      if (!bubble.active) continue;
      const previousRadius=bubble.r;
      bubble.age += dt;
      bubble.squash=Math.max(0,(bubble.squash ?? 0)-dt);
      if(bubble.targetR)bubble.r=bubbleRadius(bubble.targetR,bubble.age);
      if (bubble.age >= (bubble.targetR ? BUBBLE_LIFETIME : 12)) this.popBubble(bubble);
      if (bubble.pop >= 0) { bubble.pop += dt; if (bubble.pop >= .32) bubble.active = false; continue; }
      if (portrait) {
        // Relax toward individual drift velocities; keep palm impulses continuous.
        const blend = Math.min(1, bubble.age / .6);
        const drift = Math.sin(bubble.age * (bubble.driftRate ?? 1.4) + (bubble.driftPhase ?? 0)) * (bubble.driftSpeed ?? this.width*.06);
        bubble.vx += (drift - bubble.vx) * blend * 1.4 * dt;
        bubble.vy += (-(bubble.riseSpeed ?? this.height*.16) - bubble.vy) * blend * 1.8 * dt;
      } else {
        bubble.vx += (-bubble.vx * .55) * dt;
        bubble.vy += (-8 - bubble.vy * .55) * dt;
      }
      const speed=Math.hypot(bubble.vx,bubble.vy);
      if(speed>420){bubble.vx*=420/speed; bubble.vy*=420/speed;}
      const px=bubble.x,py=bubble.y;
      bubble.x += bubble.vx * dt; bubble.y += bubble.vy * dt;
      for(const memory of this.memories.values())if(memory.palmBody && now-memory.seen<=200)
        collideHead(bubble,px,py,memory.palmBody,dt,now,this.width,this.height,previousRadius);
      if(!portrait && this.head && now-this.head.timestamp<=200) collideHead(bubble,px,py,this.head,dt,now,this.width,this.height,previousRadius);
      if (portrait) {
        if (bubble.x + bubble.r < 0 || bubble.x - bubble.r > this.width || bubble.y + bubble.r < 0 || bubble.y - bubble.r > this.height) { bubble.active = false; continue; }
      } else {
      if (bubble.x < bubble.r) { bubble.x = bubble.r; bubble.vx = Math.abs(bubble.vx) * .3; }
      if (bubble.x > this.width - bubble.r) { bubble.x = this.width - bubble.r; bubble.vx = -Math.abs(bubble.vx) * .3; }
      if (bubble.y < bubble.r + 8) { bubble.y = bubble.r + 8; bubble.vy = Math.max(0, bubble.vy); }
      if (bubble.y > this.height - bubble.r - 8) { bubble.y = this.height - bubble.r - 8; bubble.vy = -Math.abs(bubble.vy) * .35; }
      }
      const finalSpeed=Math.hypot(bubble.vx,bubble.vy);
      if(finalSpeed>420){bubble.vx*=420/finalSpeed;bubble.vy*=420/finalSpeed;}
    }
  }
  get count() { return this.hearts.filter(h => h.active).length + this.bubbles.filter(b => b.active).length; }
}
