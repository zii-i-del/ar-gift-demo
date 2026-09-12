import assert from 'node:assert/strict';
import {spawnFirework,stepFirework,fireworkDone,headCollider} from '../lib/fireworks.ts';
for(const [w,h] of [[640,480],[360,640],[1280,720]])for(const x of [0,w*.5,w])for(const y of [0,h*.2]){
 const f=spawnFirework(x,y,w,h);const slots=f.particles;const trails=slots.map(p=>p.trail);
 assert.ok(f.target.x>=f.radius && f.target.x<=w-f.radius);
 assert.ok(f.target.y>=f.radius);
 let old=f.origin.y;
 for(let i=0;i<39;i++){stepFirework(f,1/60,null);assert.ok(f.particles[0].y<=old+.00001);old=f.particles[0].y;}
 for(let i=0;i<3&&!f.burst;i++)stepFirework(f,1/60,null);
 assert.equal(f.burst,true);assert.ok(Math.abs(f.particles[0].y-f.target.y)<.01);
 let downward=false;
 for(let i=0;i<150;i++){stepFirework(f,1/60,null);for(const p of f.particles)if(p.active){assert.ok(p.x>=0&&p.x<=w);assert.ok(p.y>=0&&p.y<=h);if(p.age>1&&p.vy>0)downward=true;}}
 assert.ok(downward);assert.ok(fireworkDone(f));
 spawnFirework(x,y,w,h,f);assert.equal(f.particles,slots);slots.forEach((p,i)=>assert.equal(p.trail,trails[i]));
 const age=f.age;stepFirework(f,5,null);assert.equal(f.age,age);
}
const face=Array(468*3).fill(.5);face[234*3]=.4;face[454*3]=.6;face[10*3+1]=.2;face[152*3+1]=.6;
const head=headCollider(face,1000,600,1000,600);assert.equal(head.x,500);
const f=spawnFirework(head.x,head.y-head.ry-28,1000,600);assert.equal(f.target.x,500,'pixel head center stays at canvas center');
console.log('PASS: pixel placement, edge-safe blooms, ascent/burst/fall/extinction, fixed-slot reuse, background gaps');
