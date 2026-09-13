import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('app/page.tsx','utf8');
const code=page.slice(page.indexOf('  const size=()=>'),page.indexOf('  const visibility='));
for(const [w,h] of [[640,360],[360,640]]){
 const listeners=new Map();let notify,reads=0,resets=0;
 const bounds={width:w,height:h},root={getBoundingClientRect(){reads++;return bounds;}};
 const v={videoWidth:0,videoHeight:0,addEventListener:(key,fn)=>listeners.set(key,fn)};
 const c={width:0,height:0,sourceW:0,sourceH:0,resize(width,height,sourceW,sourceH){Object.assign(this,{width,height,sourceW,sourceH});}},i={};
 const setup=new Function('root','v','c','i','reset','ResizeObserver',`let disposed=false;${code};return {close(){disposed=true;}};`);
 const state=setup(root,v,c,i,()=>resets++,class{constructor(fn){notify=fn;}observe(){}});
 assert.equal(resets,1);assert.equal(c.width,w);assert.equal(c.sourceW,w);
 notify();assert.equal(resets,1,'unchanged observer notification does not reset');
 v.videoWidth=1280;v.videoHeight=720;listeners.get('loadedmetadata')();
 assert.equal(c.sourceW,1280);assert.equal(resets,2);
 listeners.get('resize')();assert.equal(resets,2,'duplicate metadata event ignored');
 bounds.width=h;bounds.height=w;notify();assert.equal(i.width,h);assert.equal(i.height,w);assert.equal(resets,3);
 v.videoWidth=720;v.videoHeight=1280;listeners.get('resize')();assert.equal(c.sourceH,1280);assert.equal(resets,4);
 bounds.width=0;notify();assert.equal(resets,4);assert.equal(c.width,h);
 state.close();const before=reads;notify();assert.equal(reads,before,'late observer does not read layout');
}
const tick=page.slice(page.indexOf('  const tick='),page.indexOf('  return()=>{disposed=true'));
assert.ok(!tick.includes('size()')&&!tick.includes('getBoundingClientRect'));
assert.ok(page.includes("v.removeEventListener('loadedmetadata',size)")&&page.includes("v.removeEventListener('resize',size)"));
console.log('PASS initial/duplicate/source/orientation sizing, no per-frame layout reads, cleanup');
