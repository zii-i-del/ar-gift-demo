import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
function make(w=360,h=640,face=false){
 const e=new Interaction();e.reset('bubble');e.width=w;e.height=h;
 Object.assign(e.bubbles[0],{active:true,x:180,y:280,r:22,targetR:22,age:.5,pop:-1,vx:30,vy:-20,driftPhase:1,driftRate:1.4,driftSpeed:22,riseSpeed:105});
 if(face)e.acceptHead({x:180,y:250,rx:60,ry:80,angle:0,timestamp:0,vx:0,vy:0,omega:0,reset:false});
 return e;
}
const a=make(),b=make(360,640,true);
for(let i=0;i<10;i++){a.step(1/60,i*16);b.step(1/60,i*16);}
assert.deepEqual(a.bubbles[0],b.bubbles[0],'portrait face does not alter trajectory');
const startY=a.bubbles[0].y;
for(let i=0;i<100;i++)a.step(1/60,200+i*16);
assert(a.bubbles[0].y<startY-100,'sustained upward drift');
for(const [x,y] of [[-60,200],[420,200],[180,-60],[180,700]]){
 const e=make();Object.assign(e.bubbles[0],{x,y});e.step(1/60,16);assert(!e.bubbles[0].active,'fully offscreen bubbles recycled');
}
const edge=make();edge.bubbles[0].x=1;edge.step(1/60,16);assert(edge.bubbles[0].x<edge.bubbles[0].r,'partially visible bubble is not clamped to edge');
const wide=make(640,360);wide.bubbles[0].x=1;wide.step(1/60,16);assert(wide.bubbles[0].x>=wide.bubbles[0].r,'landscape wall behavior unchanged');
const ended=make();for(let i=0;i<500;i++)ended.step(1/60,i*16);assert(!ended.bubbles[0].active,'lifetime remains bounded');
console.log('PASS portrait drift, face pass-through, offscreen recycling, landscape boundaries, bounded lifetime');
