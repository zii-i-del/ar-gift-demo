import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {heartBirthSize} from '../lib/heart-flow.ts';

// Approved orientation factors, independent of the production size function.
for (const [width,height,factor] of [[640,360,1.01616768],[360,640,1.1025],[1920,1080,1.01616768]]) {
  const e=new Interaction(true);e.reset();e.width=width;e.height=height;
  const hand=(id,span)=>({id,span,tip:{x:160,y:180},heartOrigin:{x:160,y:180},heartDirection:{x:0,y:-1},anchor:{x:160,y:180},wrist:{x:160,y:260},heart:true,pointing:false,palm:false,reach:0});
  const hands=[hand('left',30),hand('right',160)];
  e.acceptHands(hands,0);e.acceptHands(hands,100);e.step(1/60,100);
  const active=e.hearts.filter(h=>h.active);
  assert.equal(active.length,1,'automatic mode has one primary emitter');
  assert.equal(active[0].size,heartBirthSize(width,height,0));
  assert.equal(active[0].owner,'left');
  assert.equal(active[0].colorOrder,0);
  const sizes=Array.from({length:35},(_,i)=>heartBirthSize(width,height,i));
  assert.equal(new Set(sizes).size,7);
  const expected=[.72,.96,.84,1.10,.92,1,.80].map(weight=>Math.min(144,Math.min(width,height)*.24)*.55*factor*weight);
  assert.deepEqual(sizes.slice(0,7),expected,'current approved sizes, not the obsolete pre-orientation upper bound');
  assert.ok(Math.max(...sizes)/Math.min(...sizes)>1.5);
  assert.equal(new Set(sizes.filter((_,i)=>i%2===1)).size,7,'alternating yellow hearts span all sizes');
  const initial=active[0].size;
  e.acceptHands([hand('left',200),hand('right',25)],150);
  assert.equal(active[0].size,initial,'tracking changes cannot resize an existing heart');
  for(let t=200;t<=1200;t+=50){e.acceptHands(t%100===0?[...hands].reverse():hands,t);e.step(.05,t);}
  assert(e.hearts.filter(h=>h.active).every(h=>h.owner==='left'),'secondary hand does not steal emissions');
  assert.deepEqual(e.hearts.filter(h=>h.active).map(h=>h.colorOrder),[0,1,2,3]);
}
console.log('PASS current automatic-mode sizes, orientation factors, color sequence and stable birth size');
