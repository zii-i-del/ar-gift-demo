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
const e=new Interaction();e.reset();
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
assert.equal(e.memories.size,2);const [a,b]=[...e.memories.values()];assert.ok(a.gunSequence>=8 && a.gunSequence<=10);assert.equal(b.gunSequence,0,'second hand does not duplicate the stream');
const radii=Array.from({length:7},(_,i)=>bubbleTargetRadius(80,i));assert.ok(Math.max(...radii)/Math.min(...radii)>2);assert.equal(new Set(radii).size,7);
assert.ok(radii.every(r=>r>0&&r<37));
console.log('PASS: label flips, reordered results, stale/jump rejection, stable primary across reordered hands, varied final radii');

// A greedy nearest pair steals A, even though B/A is a valid full assignment.
const closeTracks=[{id:'A',label:'Left',wrist:{x:300,y:300},seen:1000},{id:'B',label:'Right',wrist:{x:400,y:300},seen:1000}];
const closeHands=[candidate(340,'Left'),candidate(240,'Right')];
for(const ts of [closeTracks,[...closeTracks].reverse()]){
 assert.deepEqual(matchHandTracks(closeHands,ts,1080),['B','A']);
 assert.deepEqual(matchHandTracks([...closeHands].reverse(),ts,1080),['A','B']);
}
// All four edges are valid: choose the lower combined cost, not the first edge.
const broad=[candidate(310,'Unknown'),candidate(285,'Unknown')];
assert.deepEqual(matchHandTracks(broad,closeTracks,1080),['B','A']);
assert.deepEqual(matchHandTracks([],closeTracks,1080),[]);
assert.deepEqual(matchHandTracks(closeHands,[],1080),[undefined,undefined]);
const one=[closeTracks[0]];
assert.deepEqual(matchHandTracks([candidate(301,'Left'),candidate(330,'Left')],one,1080),['A',undefined]);
assert.deepEqual(matchHandTracks([candidate(300,'Left')],one,1200),['A']);
assert.deepEqual(matchHandTracks([candidate(300,'Left')],one,1201),[undefined]);
assert.deepEqual(matchHandTracks([candidate(420,'Left')],one,1080),[undefined],'distance gate remains strict');
// A real change to the other visible hand keeps that hand's identity.
assert.deepEqual(matchHandTracks([candidate(400,'Right')],closeTracks,1080),['B']);
const tied=[candidate(350,'Unknown')];
assert.deepEqual(matchHandTracks(tied,closeTracks,1080),matchHandTracks(tied,[...closeTracks].reverse(),1080));
console.log('PASS complete pairing, minimum total cost, deterministic ordering, one-hand ownership and unchanged gates');
