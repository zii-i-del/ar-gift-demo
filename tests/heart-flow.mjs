import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {fingerEmitter} from '../lib/heart-flow.ts';
import {respondContact} from '../lib/contact.ts';
const hand=(id,x,y,dx,dy)=>({id,tip:{x,y},heartOrigin:{x,y},heartDirection:{x:dx,y:dy},anchor:{x,y},wrist:{x,y:y+80},span:60,heart:true,palm:false,pointing:false,reach:0});
for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[1,-1]]) {
 const e=new Interaction();e.width=1000;e.height=800;
 const h=hand('L',400,400,dx,dy);e.acceptHands([h],0);e.acceptHands([h],100);e.step(0,100);
 const b=e.hearts.find(b=>b.active);assert.ok(b);assert.equal(b.x,400);assert.equal(b.y,400);
 for(let i=0;i<20;i++)e.step(1/60,100+i*1000/60);
 assert.ok((b.x-400)*dx+(b.y-400)*dy>0,'follows emitter direction');
 const vx=b.vx,oldX=b.x;e.acceptHands([hand('L',600,300,-dx,-dy)],450);e.step(1/60,450);
 assert.equal(b.vx,vx,'old heart keeps velocity');assert.ok(Math.abs(b.x-oldX)<3,'old heart never snaps to hand');
}
const e=new Interaction();let last=0,prior=0,max=0;
for(let i=0;i<600;i++) {const now=i*1000/60;if(i%4===0){e.acceptHands([hand('L',200,200,1,0),hand('R',400,200,-1,0)],now);if(e.emittedHearts>prior){if(last)assert.ok(now-last<=450);last=now;prior=e.emittedHearts;}}
 e.step(1/60,now);max=Math.max(max,e.hearts.filter(h=>h.active).length);assert.ok(e.hearts.filter(h=>h.active).length<=12);
}
assert.ok(e.emittedHearts>=27&&e.emittedHearts<=29&&max>=4,'bounded primary stream at 350ms cadence');
const count=e.emittedHearts;e.acceptHands([],11000);for(let i=0;i<120;i++)e.step(1/60,11000+i*1000/60);assert.equal(e.emittedHearts,count);assert.equal(e.hearts.filter(h=>h.active).length,0);
const o=fingerEmitter({x:0,y:0},{x:0,y:10},{x:-5,y:5},{x:5,y:5},{x:0,y:-10});assert.ok(Math.hypot(o.origin.x,o.origin.y-5)<1e-6);
for(const v of [20,100,300]){const a={vx:0,vy:v},b={vx:0,vy:v};respondContact(a,0,-1,0,-20);respondContact(b,0,-1,0,-20);assert.deepEqual(a,b);assert.ok(a.squashAmount<=.08);}
const away={vx:0,vy:-100};assert.equal(respondContact(away,0,-1,0,0),false);assert.equal(away.vy,-100);
console.log('PASS: directional origin, independent trail, continuous 12-slot stream, release/lifetime, segment intersection, shared response');
// Compare actual engine routes, using identical circular surface geometry.
const headEngine=new Interaction(),handEngine=new Interaction();
for(const engine of [headEngine,handEngine]){engine.reset();Object.assign(engine.bubbles[0],{active:true,x:320,y:180,r:20,age:1,pop:-1,vx:50,vy:200});}
const pose={x:320,y:230,rx:35,ry:35,vx:0,vy:-40,omega:0,angle:0,timestamp:100,reset:false};
headEngine.acceptHead(pose);
handEngine.acceptHands([{...hand('P',320,230,0,-1),heart:false,palm:true}],100);
handEngine.memories.get('P').palmBody={...pose};
for(const engine of [headEngine,handEngine])engine.step(1/60,100);
assert.ok(headEngine.bubbles[0].vy<0);
assert.ok(Math.abs(headEngine.bubbles[0].vy-handEngine.bubbles[0].vy)<.001);
assert.ok(Math.abs(headEngine.bubbles[0].vx-handEngine.bubbles[0].vx)<.001);
console.log('PASS: actual hand/head engine routes yield matching contact velocity');

// Upward thumb and sideways index emit 23 degrees from the thumb, not 45.
for(const mirror of [-1,1])for(const turn of [-.6,0,.6]){
 const transform=({x,y})=>({x:mirror*(x*Math.cos(turn)-y*Math.sin(turn)),y:x*Math.sin(turn)+y*Math.cos(turn)});
 const points=[{x:0,y:10},{x:0,y:0},{x:-5,y:5},{x:5,y:5},{x:0,y:20}].map(transform);
 const out=fingerEmitter(...points);
 const expected=transform({x:.3,y:-.7});const length=Math.hypot(expected.x,expected.y);
 assert.ok(Math.hypot(out.direction.x-expected.x/length,out.direction.y-expected.y/length)<1e-9);
 const origin=transform({x:0,y:5});assert.ok(Math.hypot(out.origin.x-origin.x,out.origin.y-origin.y)<1e-9);
}
console.log('PASS: thumb-biased direction, rotation/mirror symmetry, unchanged origin');
