import assert from 'node:assert/strict';
import {Confetti} from '../lib/confetti.ts';
import {confettiDiameter,confettiSizeRange,CONFETTI_SETTLED_WIDTH} from '../lib/confetti-config.ts';
for(const [w,h,normal,factor] of [[640,360,160,1.2],[360,640,100,.95]]){
 {const c=new Confetti();c.resize(w,h,w,h);c.modelReady=true;c.trigger(100);assert.equal(c.count,normal);
  for(let i=0;i<3;i++)for(const random of [0,.5,.999]){const expected=h*.9*factor*([.0396,.0534,.0672][i]+random*.012);assert.equal(confettiDiameter(h,h>w,i,random),expected);}
  for(let t=100;t<=2200;t+=1000/60)c.step(1/60,t);assert.equal(c.emitted,normal);
 }
 assert.deepEqual(confettiSizeRange(h,h>w),[h*.9*factor*.0396,h*.9*factor*(.0672+.012)]);
}
assert.equal(CONFETTI_SETTLED_WIDTH,1.25);console.log('PASS locked landscape/portrait diameter, fixed counts and size and emission totals');

for(const [w,h,count] of [[640,360,160],[360,640,100]]){
 const c=new Confetti();c.resize(w,h,w,h);c.modelReady=true;
 for(let now=40;now<=12000;now+=40)c.update(40,now);
 c.trigger(12100);assert.equal(c.count,count,'sustained slow frames cannot reduce the next round');
}
