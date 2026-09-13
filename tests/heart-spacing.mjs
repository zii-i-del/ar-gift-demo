import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {heartBirthOffset} from '../lib/heart-flow.ts';
const hand=id=>({id,tip:{x:300,y:300},heartOrigin:{x:300,y:300},heartDirection:{x:0,y:-1},anchor:{x:300,y:300},wrist:{x:300,y:360},span:60,heart:true,palm:false,pointing:false,reach:0});
const expected=[-10,10,-5,5,0];
for(let i=0;i<50;i++)for(const jitter of [0,.5,1]){const a=heartBirthOffset(i,jitter)*180/Math.PI;assert.ok(Math.abs(a)<=12.000001);assert.ok(Math.abs(a-expected[i%5])<=2.000001);}
function run(ids){const e=new Interaction(),births=[];let total=0;
 for(let i=0;i<180;i++){const now=i*1000/60;if(i%4===0){e.acceptHands(ids.map(hand),now);}e.step(0,now);if(e.emittedHearts>total){total=e.emittedHearts;for(const h of e.hearts)if(h.active&&h.age===0)births.push({time:now,...h});}e.step(1/60,now);assert.ok(e.hearts.filter(h=>h.active).length<=12);}
 return {e,births};}
const originalRandom=Math.random;
try{
 Math.random=()=>.5;
 const single=run(['L']),dual=run(['L','R']);
 for(const id of ['L','R']){const births=dual.births.filter(h=>h.owner===id);for(let i=0;i<births.length;i++){
  const b=births[i];assert.ok(Math.abs(Math.atan2(b.vx,-b.vy)*180/Math.PI-expected[i%5])<1e-8);
  assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-80)<1e-8);
  assert.equal(b.time,single.births[i].time);assert.equal(b.vx,single.births[i].vx);
  // Equal-age displacement remains inside the original +/-12 degree envelope.
  for(const age of [.2,.8,1.5])assert.ok(Math.abs(b.vx*age)<=80*Math.sin(12*Math.PI/180)*age);
 }}
 assert(single.births.length>=8);
 assert.deepEqual(dual.births,single.births,'a second hand does not change the primary stream');
 for(let n=1;n<single.births.length;n++)assert(Math.abs(single.births[n].time-single.births[n-1].time-350)<17);
 const blocked=new Interaction();blocked.hearts.forEach(h=>Object.assign(h,{active:true,owner:'L',age:1}));blocked.acceptHands([hand('L')],0);blocked.acceptHands([hand('L')],100);blocked.step(0,100);assert.equal(blocked.memories.get('L').heartSequence,0,'failed birth never advances sequence');
}finally{Math.random=originalRandom;}
console.log('PASS: per-hand sequence, jitter bounds, primary timing/origin/speed, narrow equal-age envelope, successful-birth counter');
