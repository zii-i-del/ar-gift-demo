// Synthetic CPU-only benchmark. Excludes camera, inference, rendering and thermals.
import { Confetti } from '../lib/confetti.ts';
import { performance } from 'node:perf_hooks';
const results=[];
for (const mode of ['air-without-surfaces','air-3-surfaces','attached']) {
 const c=new Confetti(); c.started=0; c.count=160; c.emitted=160;
 for(const [id,n,y] of [['hair',95,250],['left',31,350],['right',31,350]]) {
 const f={x:0,y,scale:640,angle:0};
 c.surfaces.set(id,{id,frame:f,previous:f,timestamp:1000,poseTime:1000,valid:true,segments:Array.from({length:n},(_,i)=>[i/n,0,(i+1)/n,0])});
 }
 if(mode==='air-without-surfaces')c.surfaces.clear();
 const samples=[];
 for(let k=0;k<2500;k++) {
 for(let i=0;i<160;i++){const p=c.particles[i];Object.assign(p,{state:mode==='attached'?2:1,x:640*(i+.5)/160,y:100,vx:0,vy:80,w:10,h:6,front:i%5===0,fadeAt:-1,surface:'hair',ax:(i+.5)/160,ay:-3/640});}
 const start=performance.now(); c.step(1/60,1000); const elapsed=performance.now()-start;
 if(k>=500)samples.push(elapsed);
 }
 samples.sort((a,b)=>a-b); results.push({mode,steps:samples.length,p50ms:samples[1000],p95ms:samples[1900]});
}
console.log(JSON.stringify({runtime:process.version,platform:process.platform,arch:process.arch,results},null,2));
