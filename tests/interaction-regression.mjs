import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
const hand=(x,y)=>({id:'left',tip:{x,y},anchor:{x,y},wrist:{x,y:y+80},span:60,heart:false,pointing:false,palm:true,reach:0});
const e=new Interaction();e.reset('bubble');
Object.assign(e.bubbles[0],{active:true,x:320,y:200,r:32,age:1,pop:-1});
e.acceptHands([hand(320,280)],0);e.acceptHands([hand(320,235)],67);
assert.equal(e.bubbles[0].vy,0,'tracking callback does not apply physics');
e.step(1/60,67);
assert.ok(e.bubbles[0].vy < -300,'upward swipe produces a strong upward impulse');
e.acceptHands([],100);for(let i=0;i<60;i++)e.step(1/60,100+i*1000/60);
assert.ok(e.bubbles[0].y<140,'impulse produces visible travel');
for(const b of e.bubbles) {Object.assign(b,{active:true,x:-500,y:1000,r:32,age:0,pop:-1});}
e.step(1/60,1200);for(const b of e.bubbles){assert.ok(b.x>=b.r && b.y<=e.height-b.r);}
const h=new Interaction();const heart={...hand(200,200),heart:true,palm:false,heartOrigin:{x:200,y:200},heartDirection:{x:0,y:-1}};
h.acceptHands([heart],0);h.acceptHands([heart],100);assert.equal(h.emittedHearts,1);
h.acceptHands([{...heart,heart:false,heartPossible:true}],180);assert.equal(h.memories.get('left').heartSince,0);
h.acceptHands([{...heart,heart:false,heartPossible:true}],340);assert.equal(h.memories.get('left').heartSince,-1);
console.log('PASS: impact, visible travel, bounds, bounded occlusion continuity');
