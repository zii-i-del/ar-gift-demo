import assert from 'node:assert/strict';
import {heartFinish,heartMote,heartSquash,collideHeart,heartCenter} from '../lib/heart-response.ts';
import {Interaction} from '../lib/interaction.ts';
import {HEART_LIFETIME as life} from '../lib/heart-flow.ts';
assert.equal(heartFinish(1),1);assert.equal(heartFinish(life),0);
let previous=heartFinish(life-.29);
for(let t=life-.29;t<=life;t+=.002){const s=heartFinish(t);assert(s<=previous+1e-8&&s>=0);previous=s;}
assert.equal(heartMote(1,80,0,1).alpha,0);assert.equal(heartMote(life+.28,80,0,1).alpha,0);
assert(heartMote(life+.1,80,0,1).alpha>.5,'motes remain visible after the heart expires');
assert(heartMote(life-.12,80,0,1).alpha>0);
assert.equal(heartSquash({age:1,contactAge:0}),0);
const heart=()=>({active:true,x:320,y:270,age:.9,size:80,owner:'emitter',vx:0,vy:100});
const h=heart(),center=heartCenter(h);
const face={x:center.x,y:center.y+54,rx:35,ry:35,angle:0,vx:0,vy:0,omega:0,timestamp:1000,reset:false};
assert(collideHeart(h,h.x,h.y-4,face,.04,1000,1000,800));assert(h.vy<0);
assert(h.vy<=-100,'definite outward impulse');
assert(!collideHeart(h,h.x,h.y,face,.04,1000,1000,800),'cooldown blocks repeated response');
for(const override of [{age:.1},{age:life-.2}]){const h={...heart(),...override};assert(!collideHeart(h,h.x,h.y,face,.04,1000,1000,800));}
assert(!collideHeart(heart(),320,266,{...face,timestamp:0},.04,1000,1000,800));
const inside=heart(),insideCenter=heartCenter(inside);
assert(!collideHeart(inside,inside.x,inside.y,{...face,x:insideCenter.x,y:insideCenter.y},.04,1000,1000,800));
// Actual engine head and palm routes use the same response; pointing is not a trigger.
for(const kind of ['face','palm','point']){
 const e=new Interaction();e.width=1000;e.height=800;Object.assign(e.hearts[0],heart());
 if(kind==='face')e.acceptHead(face);
 else{
  e.acceptHands([{id:'other',tip:{x:face.x,y:face.y},wrist:{x:face.x,y:face.y+50},anchor:{x:face.x,y:face.y},span:125,heart:false,palm:kind==='palm',pointing:kind==='point',reach:0}],1000);
  if(kind==='palm')e.memories.get('other').palmBody={...face};
 }
 e.step(.04,1000);assert.equal(e.hearts[0].vy<0,kind!=='point',kind);
}
console.log('PASS: continuous contraction, bounded motes, soft response, cooldown, stale/inside/newborn protection, face/palm only');
const e=new Interaction();Object.assign(e.hearts[0],heart(),{age:life-.16});
e.step(.02,1000);assert.equal(e.heartTails.filter(t=>t.active).length,1);
e.step(.15,1150);assert(!e.hearts[0].active);assert(e.heartTails[0].active);
Object.assign(e.hearts[0],heart(),{age:0,motesReleased:false,colorOrder:1});
assert.equal(e.heartTails[0].age>life,true,'recycling the body does not recycle its motes');
e.step(.4,1550);assert(!e.heartTails[0].active);e.reset();assert(e.heartTails.every(t=>!t.active));
