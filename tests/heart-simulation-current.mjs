import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {Interaction} from '../lib/interaction.ts';

// The historical implementation is loaded only for this regression test.
const source=execFileSync('git',['show','01a8a0a:lib/interaction.ts'],{encoding:'utf8'});
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '(.+?)'/g,(_,path)=>`from '${new URL('../lib/'+path,import.meta.url).href}'`);
const {Interaction:Before}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const [w,h] of [[640,360],[360,640]])for(const collider of ['none','face','palm']){
 const engines=[new Before(true),new Interaction()];
 const hand=t=>({id:'L',tip:{x:200,y:220},heartOrigin:{x:200+Math.sin(t/600)*10,y:220},heartDirection:{x:0,y:-1},anchor:{x:200,y:220},wrist:{x:200,y:300},span:60,heart:true,palm:false,pointing:false,reach:0});
 const face={x:245,y:170,rx:45,ry:60,angle:0,vx:0,vy:0,omega:0,reset:false};
 let hits=0,petals=0;
 for(let n=0;n<900;n++){
  const now=n*1000/60;
  for(const e of engines){
   const random=Math.random;let seed=n+1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
   try{
   e.width=w;e.height=h;
   if(collider!=='none'&&n%120===0)Object.assign(e.hearts[0],{active:true,x:205,y:105,age:.9,size:100,owner:'qa',vx:0,vy:110,appearanceAngle:0,contactAge:undefined,contactBody:undefined,contactReleased:true,motionAngle:0,angularVelocity:0,motesReleased:false});
   if(n%4===0){
    const hands=n%240<180?[hand(now)]:[];
    if(collider==='palm')hands.push({...hand(now),id:'P',heart:false,palm:true});
    e.acceptHands(hands,now);
    if(collider==='palm')e.memories.get('P').palmBody={...face,timestamp:now};
   }
   e.acceptHead(collider==='face'?{...face,timestamp:now}:null);e.step(1/60,now);
   }finally{Math.random=random;}
  }
  assert.deepEqual(engines[1].hearts,engines[0].hearts);
  assert.deepEqual(engines[1].heartPetals.groups,engines[0].heartPetals.groups);
  assert.deepEqual(engines[1].dropped,engines[0].dropped);
  assert.equal(engines[1].emittedHearts,engines[0].emittedHearts);
  hits+=engines[1].hearts.filter(p=>p.active&&p.contactAge!==undefined).length;
  petals+=engines[1].heartPetals.groups.filter(p=>p.active).length;
 }
 assert(petals>0);if(collider==='palm'||collider==='face'&&w>h)assert(hits>0);
 engines.forEach(e=>e.reset());assert.deepEqual(engines[1].hearts,engines[0].hearts);assert.deepEqual(engines[1].heartPetals.groups,engines[0].heartPetals.groups);
}
console.log('PASS 5400 frames match previous live mode: births, contacts, release, petals, recycling and reset');
