import assert from 'node:assert/strict';
import {readHand} from '../lib/interaction.ts';
import {mouthRegion} from '../lib/mouth-region.ts';
import {Confetti} from '../lib/confetti.ts';
import {GiftCoordinator} from '../lib/gift-coordinator.ts';
const face=Array(468*3).fill(.5);for(const [n,x,y] of [[234,.3,.45],[454,.7,.45],[13,.5,.58],[14,.5,.6]]){face[n*3]=x;face[n*3+1]=y;}
const raw=x=>{const h=Array(63).fill(0);for(let n=0;n<21;n++){h[n*3]=x;h[n*3+1]=.65;}h[1]=.85;for(const n of [8,12,16])h[n*3+1]=.5;return h;};
const both=[raw(.42),raw(.58)],ids=[{id:'A'},{id:'B'}];
function setup(){const c=new Confetti();c.modelReady=true;const g=new GiftCoordinator();return {c,g};}
function sample(c,g,t,raws=both,hands=ids){c.face=face;c.faceTime=t;c.hands=raws;c.handsTime=t;g.sample(c,hands.map((h,i)=>({...h,landmarks:h.landmarks??raws[i]})),t,t);}
function surface(c,t,patches=[]){c.accept({task:'hair',valid:true,timestamp:t,duration:30,faceLandmarks:face,lines:[Array.from({length:11},(_,i)=>[.3+i*.04,.3])],patches},t);}
const patch={id:1,line:[[.32,.4],[.35,.42]],region:'left'};
const {c,g}=setup();for(const t of [100,200,300,400])sample(c,g,t);assert.equal(g.phase(c,400),'preparing');
surface(c,400,[patch]);g.surfaceReady(c,420);assert(!c.playing,'one crown sample is insufficient');
surface(c,500,[patch]);g.surfaceReady(c,520);assert(c.playing,'hair arrival starts without another hand result');assert.equal(c.rounds,1);
for(let t=600;t<1000;t+=100)sample(c,g,t);assert.equal(c.rounds,1);assert(!g.armed);
c.started=-1;sample(c,g,1200,[],[]);assert(!g.armed,'abrupt disappearance is not release');
const down=both.map(h=>h.map((v,k)=>k%3===1?v+.35:v));
const away=[{id:'A',landmarks:down[0]},{id:'B',landmarks:down[1]}];sample(c,g,1300,[],away);sample(c,g,1400,[],away);sample(c,g,1600,[],[]);assert(g.armed,'observed outward motion followed by exit releases');
const short=setup();for(const t of [100,200,300,400])sample(short.c,short.g,t);surface(short.c,400);assert.equal(short.c.hairPreparation,'pending');surface(short.c,500);assert.equal(short.c.hairPreparation,'no-interior');short.g.surfaceReady(short.c,510);assert(short.c.playing);
const timeout=setup();for(let t=100;t<=1300;t+=100)sample(timeout.c,timeout.g,t);assert(!timeout.c.playing);assert(timeout.g.armed,'failed preparation does not consume rearm');
surface(timeout.c,1310);surface(timeout.c,1410);timeout.g.surfaceReady(timeout.c,1410);assert(!timeout.c.playing,'late packet alone cannot replay timed-out request');for(const t of [1400,1500,1600,1700]){sample(timeout.c,timeout.g,t);surface(timeout.c,t);timeout.g.surfaceReady(timeout.c,t);}assert(timeout.c.playing,'fresh confirmation can retry without lowering hands');
const ambiguous=both.map(h=>[...h]);ambiguous.forEach(h=>h[1]=.52);
const a=setup();sample(a.c,a.g,100);sample(a.c,a.g,200);sample(a.c,a.g,300,ambiguous);sample(a.c,a.g,400);sample(a.c,a.g,500);assert.equal(a.g.preparing,-1,'ambiguous time is not accumulated');sample(a.c,a.g,600);assert.equal(a.g.preparing,600);sample(a.c,a.g,700,ambiguous);assert.equal(a.g.candidate,-1,'only one ambiguous sample tolerated');
const released=both.map(h=>h.map((v,k)=>k%3===1?v+.5:v));const b=setup();sample(b.c,b.g,100);sample(b.c,b.g,200,released);assert.equal(b.g.candidate,-1);assert.equal(b.g.reason,'explicit-release');
const changed=setup();sample(changed.c,changed.g,100);sample(changed.c,changed.g,200);sample(changed.c,changed.g,300,both,[{id:'C'},{id:'B'}]);assert.equal(changed.g.candidate,300);
const stale=setup();for(const t of [100,200,300,400])sample(stale.c,stale.g,t);surface(stale.c,400,[patch]);surface(stale.c,500,[patch]);stale.g.surfaceReady(stale.c,800);assert(!stale.c.playing);
const duplicate=setup();sample(duplicate.c,duplicate.g,100);duplicate.g.sample(duplicate.c,ids,100,500);assert.equal(duplicate.g.preparing,-1);
const gap=setup();surface(gap.c,100,[patch]);surface(gap.c,800,[patch]);assert.equal(gap.c.hairPreparation,'pending');gap.c.invalidate();assert.equal(gap.c.hairPreparation,'pending');
console.log('PASS two-sample readiness, no-interior hair, event-driven launch, timeout retry, release, ambiguity, ID changes, stale and duplicate results');
for(const [w,h] of [[640,360],[360,640]]){
 const {c,g}=setup();c.resize(w,h,w,h);
 for(const t of [100,200,300,400])sample(c,g,t);
 surface(c,400,[patch]);surface(c,500,[patch]);g.surfaceReady(c,500);assert(c.playing);
 const awayOne=[{id:'A',landmarks:down[0]}];
 sample(c,g,600,[],awayOne);assert(!g.armed);sample(c,g,700,[],awayOne);assert(g.armed,'one visible hand away for 100 ms rearms during playback');
 sample(c,g,800);assert.equal(c.rounds,1);assert.equal(g.candidate,-1,'playback cannot bank the next candidate');
 c.update(17,7600);assert(!c.playing);
 for(const t of [7700,7800,7900,8000]){sample(c,g,t);surface(c,t,[patch]);g.surfaceReady(c,t);}
 assert.equal(c.rounds,2,'next confirmed gesture has no added cooldown');
}
const different=setup();for(const t of [100,200,300,400])sample(different.c,different.g,t);surface(different.c,400);surface(different.c,500);different.g.surfaceReady(different.c,500);
for(const t of [600,700,800])sample(different.c,different.g,t,[],[{id:'new',landmarks:down[0]}]);assert(different.g.armed,'reacquired identity with fresh continuous away evidence can release');
console.log('PASS both orientations: release with one hand in 100 ms, release during playback, second round, no banking and identity-safe release');
// Full repeat lifecycle: every round loses tracking and receives fresh tracker IDs.
// There must be no relationship between the release ID and the trigger ID.
for(const [w,h] of [[640,360],[360,640]]){
 const {c,g}=setup();c.resize(w,h,w,h);
 for(let round=0;round<20;round++){
  const base=round*8000,tracked=[{id:`cover-${round}-A`},{id:`cover-${round}-B`}];
  for(const d of [100,200,300,400]){sample(c,g,base+d,both,tracked);surface(c,base+d,[patch]);g.surfaceReady(c,base+d);}
  assert.equal(c.rounds,round+1,`round ${round+1} must start`);
  sample(c,g,base+900,[],[]);assert(!g.armed,'missing hands alone cannot release');
  const reacquired=[{id:`returned-${round}`,landmarks:down[0]}];
  sample(c,g,base+1100,[],reacquired);assert(!g.armed,'one new observation is not enough');
  sample(c,g,base+1200,[],reacquired);assert(g.armed,'new track can establish fresh release evidence');
  sample(c,g,base+1300,both,tracked);assert.equal(g.candidate,-1);
  c.update(17,base+7500);assert(!c.playing);
 }
 assert.equal(c.rounds,20);
}
console.log('PASS 20 consecutive rounds in each orientation with per-round loss and new tracker IDs');

// Real parsing path, no fabricated gift anchor. Hands move sideways/down and
// disappear; cover -> release -> cover never requires a heart/bubble gesture.
function naturalHand(x,dy=0){
 const h=Array(63).fill(0);
 for(let n=0;n<21;n++){h[n*3]=x;h[n*3+1]=.74+dy;}
 h[1]=.94+dy;
 for(const [b,t,dx] of [[5,8,-.04],[9,12,-.015],[13,16,.015],[17,20,.04]])
  for(let n=b;n<=t;n++){h[n*3]=x+dx;h[n*3+1]=.74-(n-b)*.05+dy;}
 return h;
}
for(const [w,h] of [[640,360],[360,640]]){
 const {c,g}=setup();c.resize(w,h,w,h);
 const natural=[naturalHand(.28),naturalHand(.72)];
 const parsed=natural.map((r,i)=>readHand(r,`natural-${i}`,w,h,w,h));
 assert(parsed.every(Boolean));c.face=face;c.faceTime=0;
 const mouth=c.mouthReference(0),frame=c.frame(face);
 assert(parsed.every(hand=>Math.hypot(hand.anchor.x-mouth.x,hand.anchor.y-mouth.y)/frame.scale<.65),'fixture reproduces old release rejection');
 assert(natural.every(raw=>mouthRegion(raw,c.map,mouth,frame.scale).state==='away'));
 for(let round=0;round<5;round++){
  const base=round*8000;
  for(const d of [100,200,300,400]){sample(c,g,base+d);surface(c,base+d,[patch]);g.surfaceReady(c,base+d);}
  assert.equal(c.rounds,round+1);
  sample(c,g,base+500);assert(!g.armed,'continued cover cannot release');
  sample(c,g,base+600,natural,parsed);sample(c,g,base+700,natural,parsed);assert(g.armed);
  sample(c,g,base+800,[],[]);assert(g.armed,'completed release survives exit');
  c.update(17,base+7500);
 }
}
console.log('PASS real readHand geometry: old threshold failure, 5 direct rounds each orientation');
// Asynchronous face/hand packets must pause, rather than erase, release progress.
const jitter=setup();jitter.g.armed=false;
sample(jitter.c,jitter.g,100,down,away);sample(jitter.c,jitter.g,150,down,away);
assert.equal(jitter.g.releaseDebug.elapsedMs,50);
jitter.c.faceTime=-100;jitter.g.sample(jitter.c,away,200,200);
assert.equal(jitter.g.releaseDebug.elapsedMs,50);assert(!jitter.g.armed);
sample(jitter.c,jitter.g,250,down,away);assert(!jitter.g.armed);
sample(jitter.c,jitter.g,300,down,away);assert(jitter.g.armed);
const lost=setup();lost.g.armed=false;
sample(lost.c,lost.g,100,down,away);sample(lost.c,lost.g,150,down,away);
sample(lost.c,lost.g,400,[],[]);sample(lost.c,lost.g,450,down,away);
assert.equal(lost.g.releaseDebug.elapsedMs,0);assert(!lost.g.armed);
console.log('PASS stale face pauses release; loss over 200 ms cannot carry accumulation');
