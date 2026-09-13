import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunPose3D} from '../lib/gun-pose.ts';
import {readHand,Interaction} from '../lib/interaction.ts';
const [sample]=JSON.parse(fs.readFileSync(new URL('./fixtures/gun-real-landmarks.json',import.meta.url)));
for(const angle of [-1,0,1]){
 const world=sample.world.map((v,i,a)=>i%3===0?v*Math.cos(angle)-a[i+2]*Math.sin(angle):i%3===2?a[i-2]*Math.sin(angle)+v*Math.cos(angle):v);
 assert.equal(gunPose3D(world).state,'valid','3D rotation preserves joint classification');
}
for(const missing of [undefined,null,[],Array(63).fill(NaN)]){
 const h=readHand(sample.raw,'test',sample.width,sample.height,sample.width,sample.height,missing);
 assert.equal(h.gun,false,'missing world data cannot fall back to permissive 2D');
}
const world=[...sample.world];
// Force a folded distal bone while leaving the 2D image straight.
for(let k=0;k<3;k++)world[24+k]=world[21+k]-(world[21+k]-world[18+k])*.8;
const bad=readHand(sample.raw,'test',sample.width,sample.height,sample.width,sample.height,world);
assert.equal(bad.gun,false);
const good=readHand(sample.raw,'test',sample.width,sample.height,sample.width,sample.height,sample.world);
const e=new Interaction();e.reset();
for(let i=0;i<60;i++){const now=i*1000/60;if(i%4===0)e.acceptHands([good],now);e.step(1/60,now);}
assert.ok(e.emittedBubbles>0);const count=e.emittedBubbles;
for(let i=60;i<120;i++){const now=i*1000/60;if(i%4===0)e.acceptHands([bad],now);e.step(1/60,now);}
assert.equal(e.emittedBubbles,count,'3D bent evidence stops confirmed emitter');
console.log('PASS: world rotation, missing data, 3D veto and immediate emission stop');

const lost=new Interaction();lost.reset();
for(let i=0;i<60;i++){const now=i*1000/60;if(i%4===0)lost.acceptHands([good],now);lost.step(1/60,now);}
const beforeLost=lost.emittedBubbles;
lost.acceptHands([],1000);
assert.match(lost.hint,/未识别到手/);
for(let i=0;i<12;i++)lost.step(1/60,1000+i*1000/60);
assert.equal(lost.emittedBubbles,beforeLost,'explicit hand loss immediately stops emission');
lost.acceptHands([good],1200);lost.step(1/60,1200);
assert.equal(lost.emittedBubbles,beforeLost,'recovered hand must confirm again');
console.log('PASS: no-hand feedback and emission reset');

const gap=new Interaction();gap.reset();
for(let t=0;t<=600;t+=50){gap.acceptHands([good],t);gap.step(1/60,t);}
const n=gap.emittedBubbles;
const uncertain={...good,gun:false,gunUncertain:true};
gap.acceptHands([uncertain],650);gap.step(1/60,650);
assert.equal(gap.emittedBubbles,n,'uncertainty must suspend births');
gap.acceptHands([good],750);gap.step(1/60,750);
assert.equal(gap.emittedBubbles,n,'current primary must reconfirm after an uncertain gesture');
for(const t of [850,950,1000]){gap.acceptHands([good],t);gap.step(1/60,t);}
assert.ok(gap.emittedBubbles>n,'fresh confirmed gesture resumes');
gap.acceptHands([uncertain],1050);gap.step(1/60,1050);
gap.acceptHands([good],1250);const after=gap.emittedBubbles;gap.step(1/60,1250);
assert.equal(gap.emittedBubbles,after,'long uncertainty requires fresh confirmation');
const initial=new Interaction();initial.reset();
initial.acceptHands([good],0);initial.acceptHands([uncertain],100);initial.acceptHands([good],200);initial.step(1/60,300);
assert.equal(initial.emittedBubbles,0,'initial confirmation cannot bridge uncertainty');
console.log('PASS: G6 uncertainty suspends births, bounded recovery and first confirmation');
