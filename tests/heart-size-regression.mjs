import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {heartBirthSize} from '../lib/heart-flow.ts';

for (const [width,height] of [[640,400],[360,280],[1920,1080]]) {
  const e=new Interaction();e.reset('hearts');e.width=width;e.height=height;
  const hand=(id,span)=>({id,span,tip:{x:160,y:180},heartOrigin:{x:160,y:180},heartDirection:{x:0,y:-1},anchor:{x:160,y:180},wrist:{x:160,y:260},heart:true,pointing:false,palm:false,reach:0});
  const hands=[hand('left',30),hand('right',160)];
  e.acceptHands(hands,0);e.acceptHands(hands,100);
  const active=e.hearts.filter(h=>h.active);
  assert.equal(active.length,2);
  assert.equal(active[0].size,heartBirthSize(width,height,0));
  assert.equal(active[1].size,heartBirthSize(width,height,1));
  assert.deepEqual(active.map(h=>h.colorOrder),[0,0],'each hand starts its own color sequence');
  const sizes=Array.from({length:35},(_,i)=>heartBirthSize(width,height,i));
  assert.equal(new Set(sizes).size,7);
  assert.ok(Math.max(...sizes)<=Math.min(144,Math.min(width,height)*.24)*.55*1.1);
  assert.ok(Math.max(...sizes)/Math.min(...sizes)>1.5);
  assert.equal(new Set(sizes.filter((_,i)=>i%2===1)).size,7,'alternating yellow hearts span all sizes');
  const initial=active[0].size;
  e.acceptHands([hand('left',200),hand('right',25)],150);
  assert.equal(active[0].size,initial,'tracking changes cannot resize an existing heart');
  for(let t=200;t<=1200;t+=50)e.acceptHands(t%100===0?[...hands].reverse():hands,t);
  for(const id of ['left','right']){
    const own=e.hearts.filter(h=>h.active&&h.owner===id);
    assert.deepEqual(own.map(h=>h.colorOrder),[0,1,2,3],'hand colors alternate independently of processing order');
  }
}
console.log('PASS: staggered sizes, previous maximum preserved, color-independent, stable after birth');
