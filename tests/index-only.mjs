import assert from 'node:assert/strict';
import {readHand,Interaction} from '../lib/interaction.ts';
const base=[[.5,.85],[.44,.76],[.4,.68],[.43,.66],[.47,.66],[.5,.6],[.5,.46],[.5,.36],[.5,.26],[.56,.61],[.57,.57],[.57,.68],[.56,.72],[.62,.63],[.63,.59],[.63,.7],[.62,.74],[.68,.65],[.69,.62],[.69,.72],[.68,.76]];
const classify=(points,mirror=false)=>readHand(points.flatMap(([x,y])=>[mirror?1-x:x,y,0]),'L',600,600,600,600);
const thumb=base.map(p=>[...p]);thumb[3]=[.4,.5];thumb[4]=[.4,.35];thumb[6]=[.49,.55];thumb[7]=[.52,.66];thumb[8]=[.54,.72];
const heart=base.map(p=>[...p]);heart[2]=[.43,.7];heart[3]=[.43,.5];heart[4]=[.43,.35];heart[5]=[.36,.55];heart[6]=[.43,.5];heart[7]=[.52,.48];heart[8]=[.6,.46];
const resting=base.map(p=>[...p]);resting[2]=[.39,.66];resting[3]=[.46,.56];resting[4]=[.55,.5];
for(const mirror of [false,true]) {
 const r=classify(resting,mirror);
 assert.equal(r.pointing,true,'thumb across index base is ordinary pointing');
 const emitter=new Interaction();emitter.reset('bubble');
 for(let t=0;t<=500;t+=50)emitter.acceptHands([r],t);
 assert.equal(emitter.emittedBubbles,0,'index dwell no longer emits without extended thumb');
 assert.equal(classify(base,mirror).pointing,true,'straight index accepted');
 for(const points of [thumb,heart]) {
 const h=classify(points,mirror);assert.equal(h.pointing,false,'thumb/heart rejected');
 const e=new Interaction();e.reset('bubble');for(let t=0;t<1500;t+=67)e.acceptHands([h],t);assert.equal(e.emittedBubbles,0);
 }
}
console.log('PASS: both hands index accepted; thumb and crossed heart do not emit');
