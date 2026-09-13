import assert from 'node:assert/strict';
import {readHand,Interaction} from '../lib/interaction.ts';
// Synthetic geometry: distal crossing versus crossing only root-to-tip shortcuts.
// These are regression inputs, not landmark captures from the user's screenshot.
const pose=[[.5,.85],[.44,.76],[.43,.7],[.43,.5],[.43,.35],[.36,.55],[.43,.5],[.52,.48],[.6,.46],[.56,.61],[.57,.57],[.57,.68],[.56,.72],[.62,.63],[.63,.59],[.63,.7],[.62,.74],[.68,.65],[.69,.62],[.69,.72],[.68,.76]];
const relaxed=pose.map(p=>[...p]);relaxed[6]=[.58,.64];relaxed[7]=[.59,.65];relaxed[8]=[.6,.66];
for(const mirror of [false,true]){
 const read=p=>readHand(p.flatMap(([x,y])=>[mirror?1-x:x,y,0]),'left',600,600,600,600);
 const good=read(pose),bad=read(relaxed);
 const shortThumb=pose.map(p=>[...p]);shortThumb[4]=[.43,.49];
 const shortIndex=pose.map(p=>[...p]);shortIndex[7]=[.435,.499];shortIndex[8]=[.44,.498];
 const pinch=pose.map(p=>[...p]);pinch[4]=[.6,.46];
 for(const negative of [shortThumb,shortIndex,pinch]) {
   const h=read(negative);
   assert.equal(h.heart,false,'both tips must extend past contact');
   assert.equal(h.heartPossible,false,'occlusion grace cannot bypass exposed-tip requirement');
   const stopped=new Interaction();stopped.acceptHands([good],0);stopped.acceptHands([good],134);stopped.step(0,134);
   for(let t=201;t<2000;t+=67){stopped.acceptHands([h],t);stopped.step(0,t);}
   assert.equal(stopped.emittedHearts,1,'short tips stop an already running stream');
 }
 for(const scale of [.7,1,1.2])for(const angle of [-.5,0,.5]){
   const transformed=pose.map(([x,y])=>[.5+scale*((x-.5)*Math.cos(angle)-(y-.6)*Math.sin(angle)),.6+scale*((x-.5)*Math.sin(angle)+(y-.6)*Math.cos(angle))]);
   assert.equal(read(transformed).heart,true,'crossing survives scale and rotation');
 }
 assert.equal(good.heart,true,'actual distal crossing accepted');
 assert.equal(bad.heart,false,'root-only crossing rejected');
 const e=new Interaction();
 for(let t=0;t<2000;t+=67)e.acceptHands([bad],t);
 assert.equal(e.emittedHearts,0,'relaxed pose never starts emitter');
 e.reset();e.acceptHands([good],0);
 const uncertain={...good,heart:false,heartPossible:true};
 for(let t=67;t<1500;t+=67)e.acceptHands([uncertain],t);
 assert.equal(e.emittedHearts,0,'one strong frame cannot bootstrap emission via tolerance');
 e.reset();e.acceptHands([good],0);e.acceptHands([good],134);e.step(0,134);
 assert.equal(e.emittedHearts,1);
 e.acceptHands([uncertain],201);assert.equal(e.memories.get('left').heartConfirmed,false);
 for(let t=268;t<1600;t+=67)e.acceptHands([uncertain],t);
 assert.equal(e.memories.get('left').heartConfirmed,false);
 assert.equal(e.emittedHearts,1,'uncertainty cannot renew confirmed state indefinitely');
 e.acceptHands([good],1700);e.acceptHands([good],1834);e.step(0,1834);
 assert.equal(e.emittedHearts,2,'clear crossing can rearm normally');
}
console.log('PASS: mirrored distal crossing, relaxed negative, strict entry, bounded occlusion, reentry');
