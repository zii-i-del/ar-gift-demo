import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
function setup(width=1280,height=720){
 const i=new Interaction(true);i.width=width;i.height=height;
 Object.assign(i.bubbles[0],{active:true,x:width/2,y:height/2,vx:0,vy:0,r:20,targetR:20,age:0,pop:-1,riseSpeed:0,driftSpeed:0});
 return i;
}
for(const [w,h] of [[1280,720],[720,1280]])for(const fps of [60,30,20,10]){
 const i=setup(w,h),dt=1/fps;let time=0,start;
 while(i.bubbles[0].active&&time<15){time+=dt;i.step(Math.min(dt,.04),time*1000,dt);if(start===undefined&&i.bubbles[0].pop>=0)start=time;}
 assert.ok(start>=5-1e-9&&start<=5+dt+1e-9,`${fps}fps: burst ${start}`);
 assert.ok(time>=5.32-1e-9&&time<=5.32+dt+1e-9,`${fps}fps: recycle ${time}`);
}
{
 const i=setup(),b=i.bubbles[0];b.age=4.9;i.step(.04,5300,.4);
 assert.ok(Math.abs(b.pop-.3)<1e-9,'only time after expiry belongs to rupture');
 i.step(.04,5400,.1);assert.equal(b.active,false);assert.equal(i.popped,1);
}
{
 const i=setup(),b=i.bubbles[0];i.popBubble(b);i.step(.04,400,.4);assert.equal(b.active,false);
 const j=setup();j.bubbles[0].age=4.9;j.step(.04,6000,1.1);assert.equal(j.bubbles[0].active,false);
}
{
 const a=setup(),b=setup();a.step(.04,1000,1);b.step(.04,1000,.04);
 assert.equal(a.bubbles[0].x,b.bubbles[0].x);assert.equal(a.bubbles[0].y,b.bubbles[0].y,'physics does not catch up');
 a.reset();a.step(.04,2000,1);assert.equal(a.bubbles.some(b=>b.active),false,'reset cannot revive bubbles');
}
console.log('PASS bubble wall clock, expiry crossing, external rupture, bounded motion and reset');
