import assert from 'node:assert/strict';
import {matchHandTracks} from '../lib/hand-tracks.ts';
import {Interaction} from '../lib/interaction.ts';
import {bubbleTargetRadius} from '../lib/bubble-stream.ts';
const candidate=(x,label)=>({label,hand:{wrist:{x,y:300},span:60}});
const tracks=[{id:'A',label:'Left',wrist:{x:200,y:300},seen:0},{id:'B',label:'Right',wrist:{x:500,y:300},seen:0}];
assert.deepEqual(matchHandTracks([candidate(202,'Right'),candidate(498,'Left')],tracks,67),['A','B']);
assert.deepEqual(matchHandTracks([candidate(498,'Left'),candidate(202,'Right')],tracks,67),['B','A']);
assert.deepEqual(matchHandTracks([candidate(202,'Left')],tracks,250),[undefined]);
assert.deepEqual(matchHandTracks([candidate(800,'Right')],tracks,67),[undefined]);
const e=new Interaction();e.reset('bubble');
for(let frame=0;frame<120;frame++){
 const now=frame*1000/60;
 if(frame%4===0){
  const cs=[candidate(200,frame%8?'Right':'Left'),candidate(500,frame%8?'Left':'Right')];
  if(frame%8)cs.reverse();
  const ids=matchHandTracks(cs,tracks,now);
  const hands=cs.map((c,i)=>({...c.hand,id:ids[i],tip:{x:c.hand.wrist.x,y:180},anchor:c.hand.wrist,heart:false,palm:false,pointing:false,reach:0,gun:true,gunDirection:{x:0,y:-1}}));
  e.acceptHands(hands,now);tracks.forEach(t=>t.seen=now);
 }
 e.step(1/60,now);
}
assert.equal(e.memories.size,2);const [a,b]=[...e.memories.values()];assert.ok(a.gunSequence>10);assert.equal(a.gunSequence,b.gunSequence);
const radii=Array.from({length:7},(_,i)=>bubbleTargetRadius(80,i));assert.ok(Math.max(...radii)/Math.min(...radii)>2);assert.equal(new Set(radii).size,7);
assert.ok(radii.every(r=>r>0&&r<37));
console.log('PASS: label flips, reordered results, stale/jump rejection, equal two-hand cadence, varied final radii');
