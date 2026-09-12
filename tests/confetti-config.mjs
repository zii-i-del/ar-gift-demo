import assert from 'node:assert/strict';
import {Confetti} from '../lib/confetti.ts';
import {confettiDiameter,confettiSizeRange,CONFETTI_SETTLED_WIDTH} from '../lib/confetti-config.ts';
for(const [w,h,normal,reduced,factor] of [[640,360,160,100,1.2],[360,640,100,75,.95]]){
 for(const low of [false,true]){const c=new Confetti();c.resize(w,h,w,h);c.modelReady=true;c.low=low;c.trigger(100);assert.equal(c.count,low?reduced:normal);assert.equal(c.roundLow,low);
  for(let i=0;i<3;i++)for(const random of [0,.5,.999]){const expected=h*.9*factor*([.0396,.0534,.0672][i]+random*.012);assert.equal(confettiDiameter(h,h>w,i,random),expected);}
  for(let t=100;t<=2200;t+=1000/60)c.step(1/60,t);assert.equal(c.emitted,low?reduced:normal);
 }
 assert.deepEqual(confettiSizeRange(h,h>w),[h*.9*factor*.0396,h*.9*factor*(.0672+.012)]);
}
assert.equal(CONFETTI_SETTLED_WIDTH,1.25);console.log('PASS locked landscape/portrait diameter, standard/low counts, unchanged size on downgrade and emission totals');
