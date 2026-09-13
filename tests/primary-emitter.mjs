import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {PrimaryEmitter} from '../lib/primary-emitter.ts';
const hand=(id,kind)=>({id,span:60,tip:{x:180,y:220},anchor:{x:180,y:280},wrist:{x:180,y:300},heartOrigin:{x:180,y:220},heartDirection:{x:0,y:-1},heart:kind==='hearts',heartPossible:false,gun:kind==='bubble',gunDirection:{x:0,y:-1},palm:kind==='palm',pointing:false,reach:0});
function run(kind,portrait,two){
 const e=new Interaction(true);e.reset();e.width=portrait?360:640;e.height=portrait?640:360;const births=[];
 for(let n=0;n<120;n++){const t=n*1000/60;if(n%5===0)e.acceptHands(two?[hand('B',kind),hand('A',kind)]:[hand('A',kind)],t);const before=e.emittedHearts+e.emittedBubbles;e.step(1/60,t);if(e.emittedHearts+e.emittedBubbles>before)births.push(t);}
 return {e,births};
}
for(const kind of ['hearts','bubble'])for(const portrait of [false,true]){
 const a=run(kind,portrait,false),b=run(kind,portrait,true);assert.deepEqual(a.births,b.births,'second hand cannot change cadence');
 const minimum=kind==='hearts'?350:portrait?180:160;
 for(let n=1;n<a.births.length;n++){const gap=a.births[n]-a.births[n-1];assert(gap>=minimum-1e-8);assert(gap<=minimum+(kind==='bubble'?40:0)+17,'no per-hand or inference-clock extra throttle');}
 assert(a.births.length>2);console.log(kind,portrait?'portrait':'landscape',a.births.length);
}
const p=new PrimaryEmitter(),candidate=(id,kind='hearts',confirmed=true)=>({id,kind,confirmed});
p.update([candidate('B'),candidate('A')],100);assert.equal(p.id,'A');p.update([candidate('B','bubble')],150);assert.equal(p.select(150),undefined,'missing primary immediately stops emission');assert.equal(p.id,'A');assert.equal(p.select(301).id,'B','fresh secondary takes over after tracking expiry');
p.update([candidate('B','hearts',false),candidate('A')],350);assert.equal(p.id,'B');assert.equal(p.select(350),undefined,'owner changes gesture with fresh confirmation');p.update([candidate('B','hearts'),candidate('A')],450);assert.equal(p.select(450).id,'B');p.update([candidate('B',''),candidate('A')],500);assert.equal(p.id,'A','explicit stop immediately releases');assert.equal(p.select(800),undefined);
const mixed=new Interaction(true);mixed.reset();for(const t of [0,100,200,300]){mixed.acceptHands([hand('A','hearts'),hand('B','bubble')],t);mixed.step(.016,t);}assert(mixed.emittedHearts>0);assert.equal(mixed.emittedBubbles,0);
mixed.acceptHands([hand('A','palm'),hand('B','bubble')],350);mixed.step(.016,350);assert.equal(mixed.primaryEmitter.id,'B');assert(mixed.emittedBubbles>0);assert(mixed.memories.get('A').palmBody,'secondary palm remains usable');
const old=mixed.emittedBubbles;mixed.autoBlocked=true;mixed.step(.016,360);mixed.autoBlocked=false;mixed.step(.016,370);assert.equal(mixed.emittedBubbles,old,'mouth suspension cannot resume cached gesture');mixed.acceptHands([hand('B','bubble')],400);mixed.step(.016,400);assert.equal(mixed.emittedBubbles,old);
const quota=run('hearts',true,false).e;assert(quota.hearts.filter(h=>h.active).length>0,'primary emits within global budget');const active=quota.hearts.filter(h=>h.active).length;quota.autoConfetti=true;quota.step(.016,2010);assert(quota.hearts.filter(h=>h.active).length<=active,'tightening does not add above cap');
console.log('PASS primary cadence, first/tie ownership, gesture transition, disappearance, palm, global quota and suspension');

assert.ok(run('bubble',false,false).births.length > run('bubble',true,false).births.length,'landscape emits slightly faster');
