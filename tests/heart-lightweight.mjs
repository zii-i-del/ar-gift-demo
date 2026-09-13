import assert from 'node:assert/strict';
import {Interaction} from '../lib/interaction.ts';
import {HeartPetalPool,collideLiteHeart,stepHeartTurn} from '../lib/heart-lightweight.ts';
const make=()=>({active:true,x:205,y:105,age:.9,size:100,owner:'qa',vx:0,vy:110,appearanceAngle:0,birthOrder:1});
const face={x:245,y:170,rx:45,ry:60,angle:0,vx:0,vy:0,omega:0,timestamp:1000,reset:false};
for(const x of [205,245,285]){
 const h={...make(),x};let hit=false;
 for(let i=0;i<40;i++){const px=h.x,py=h.y;h.age+=1/60;h.x+=h.vx/60;h.y+=h.vy/60;stepHeartTurn(h,1/60);hit=collideLiteHeart(h,px,py,face,1/60,1000,440,360,'face')||hit;}
 assert(hit,'confirmed collision');assert(h.vy<0,'outward rebound');assert(Math.abs(h.motionAngle)<.874);if(x===245)assert(Math.abs(h.motionAngle)<.01);else assert(Math.abs(h.motionAngle)>.2,'visible glancing turn');
 console.log('collision',x,'angle',Math.round(h.motionAngle*180/Math.PI),'position',h.x,h.y);
}
const pool=new HeartPetalPool(),refs=pool.groups.map(g=>g.items);const counts=new Set();
for(let i=0;i<12;i++){assert(pool.spawn({...make(),age:1.75,birthOrder:i}));counts.add(pool.groups[i].count);}
assert(counts.size>1);assert(!pool.spawn(make()));assert(pool.groups.reduce((n,g)=>n+g.count,0)<=72);pool.step(.56);assert(pool.groups.every(g=>!g.active));pool.reset();assert(refs.every((r,i)=>r===pool.groups[i].items));
{
 const e=new Interaction(),times=[];e.width=440;e.height=360;
 for(let f=0;f<8400;f++){for(let i=0;i<12;i++)if(!e.hearts[i].active)Object.assign(e.hearts[i],make(),{x:180+i*8,age:.85,birthOrder:f+i,contactAge:undefined,contactBody:undefined,motesReleased:false,motionAngle:0});e.acceptHead({...face,timestamp:f*16.67});const t=performance.now();e.step(1/60,f*16.67);if(f>=1200)times.push(performance.now()-t);}
 times.sort((a,b)=>a-b);console.log('current',{p95:times[Math.floor(times.length*.95)],p99:times[Math.floor(times.length*.99)],frames:times.length});
}
console.log('PASS: rebound, bounded turn, variable fixed pool, overflow and recycling');
