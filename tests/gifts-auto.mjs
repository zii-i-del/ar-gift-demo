import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {GiftCoordinator} from '../lib/gift-coordinator.ts';
import '../public/gift-scheduler.js';
const hand=(id,kind)=>({id,span:60,tip:{x:180,y:220},anchor:{x:180,y:280},wrist:{x:180,y:300},heartOrigin:{x:180,y:220},heartDirection:{x:0,y:-1},heart:kind==='heart',heartPossible:false,gun:kind==='bubble',gunDirection:{x:0,y:-1},palm:false,pointing:false,reach:0});
const e=new Interaction();e.reset();e.width=640;e.height=360;
for(let n=0;n<120;n++){const now=n*1000/60;if(n%5===0)e.acceptHands([hand('A','heart'),hand('B','bubble')],now);e.step(1/60,now);}
assert(e.emittedHearts>0&&e.emittedBubbles===0,'first confirmed hand owns both gift channels');assert(e.bubbles.filter(b=>b.active).length<=32);assert(e.hearts.filter(h=>h.active).length<=12);
const g=new GiftCoordinator();assert.deepEqual(g.filter([{...hand('A','heart'),gun:true}],false).map(h=>[h.heart,h.gun]),[[false,false]]);
const emitted=e.emittedHearts;e.acceptHands([hand('A','heart')],0);assert.equal(e.emittedHearts,emitted,'old samples cannot emit');
e.autoBlocked=true;for(let n=120;n<180;n++){e.acceptHands([hand('A','heart'),hand('B','bubble')],n*17);e.step(.017,n*17);}assert.equal(e.emittedHearts,emitted,'blocked gestures cannot emit');
const fair=new Interaction();fair.reset();for(let n=0;n<25;n++){fair.acceptHands(n%2?[hand('B','heart'),hand('A','heart')]:[hand('A','heart'),hand('B','heart')],n*100);fair.step(.1,n*100);}const owners=fair.hearts.filter(h=>h.active).map(h=>h.owner);assert(owners.every(x=>x==='A'),'stable primary hand independent of result order');
fair.autoConfetti=true;const old=fair.hearts.filter(h=>h.active).length;fair.acceptHands([hand('A','heart'),hand('B','heart')],2600);assert.equal(fair.hearts.filter(h=>h.active).length,old,'lower cap does not delete existing hearts');
const last={hands:0,face:0,hair:0,pose:0},cost={hands:20,face:15,hair:30,pose:20};
assert.equal(GiftScheduler.select(101,'playing',last,cost,new Set(),700).task,'hands');
assert.equal(GiftScheduler.rates('idle').hair,0);assert.equal(GiftScheduler.rates('playing').hands,12);
assert.equal(GiftScheduler.select(101,'playing',last,cost,new Set(),0).task,null);
console.log('PASS auto coexistence, conflict, old results, blocking, fairness, peak caps, priority scheduler');

// A tracking gap stops births, but fresh confirmed gestures need no recovery timer.
for (const portrait of [false,true]) for (const kind of ['heart','bubble']) {
 const model=new Interaction();model.reset();model.width=portrait?360:640;model.height=portrait?640:360;
 for(let t=0;t<=600;t+=100){model.acceptHands([hand('A',kind)],t);model.step(.1,t);}
 const before=model.emittedHearts+model.emittedBubbles;assert(before>0);
 model.autoBlocked=true;
 for(let t=900;t<=5000;t+=100)model.step(.1,t);
 assert.equal(model.emittedHearts+model.emittedBubbles,before,'stale input cannot keep emitting');
 model.autoBlocked=false;
 model.acceptHands([hand('A',kind)],5100);model.step(.1,5100);
 assert.equal(model.emittedHearts+model.emittedBubbles,before,'fresh input must confirm again');
 for(let t=5200;t<=5400;t+=100){model.acceptHands([hand('A',kind)],t);model.step(.1,t);}
 assert(model.emittedHearts+model.emittedBubbles>before,'confirmed input resumes without a three-second recovery');
}
console.log('PASS stale input stops births and fresh gestures resume after normal confirmation');
