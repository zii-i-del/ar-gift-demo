import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const source=ts.createSourceFile('gift.ts',fs.readFileSync('lib/gift-renderer.ts','utf8'),ts.ScriptTarget.Latest,true);
const cls=source.statements.find(ts.isClassDeclaration),draw=cls.members.find(m=>m.name?.getText(source)==='draw').getText(source);
const compiled=ts.transpileModule(`class Subject {${draw}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const Subject=new Function('THREE',compiled+';return Subject;')(THREE);
for(const [width,height] of [[640,360],[360,640]]){
 globalThis.devicePixelRatio=1;
 const calls=[],s=new Subject();let dpr=1;
 Object.assign(s,{needsClear:true,ready:{hearts:true,bubble:true},renderer:{domElement:{width,height},getPixelRatio:()=>dpr,setPixelRatio:v=>{dpr=v;},setSize(w,h){this.domElement.width=Math.floor(w*dpr);this.domElement.height=Math.floor(h*dpr);},setRenderTarget(){},clear:()=>calls.push('clear'),clearDepth:()=>calls.push('depth')},confetti:{draw:()=>calls.push('stars')},hearts:{draw:()=>calls.push('hearts')},bubbles:{draw:()=>calls.push('bubbles')}});
 const c={width,height,active:0},i={hearts:[{active:false}],bubbles:[{active:false,pop:.2}],heartPetals:{groups:[{active:false}]}};
 const tick=()=>s.draw(c,i,{});
 for(let n=0;n<60;n++)tick();assert.deepEqual(calls,['clear']);calls.length=0;
 c.active=1;i.hearts[0].active=true;i.bubbles[0].active=true;tick();
 assert.deepEqual(calls,['clear','stars','depth','hearts','depth','bubbles'],'first frame and authored ordering');calls.length=0;
 c.active=0;i.hearts[0].active=false;i.heartPetals.groups[0].active=true;tick();
 assert.deepEqual(calls,['clear','depth','hearts','depth','bubbles'],'petals and ruptures remain visible');calls.length=0;
 i.heartPetals.groups[0].active=false;i.bubbles[0].active=false;for(let n=0;n<60;n++)tick();assert.deepEqual(calls,['clear']);calls.length=0;
 c.width+=10;tick();tick();assert.deepEqual(calls,['clear']);calls.length=0;
 globalThis.devicePixelRatio=1.5;tick();tick();assert.deepEqual(calls,['clear']);calls.length=0;
 i.hearts[0].active=true;s.ready.hearts=false;tick();assert.deepEqual(calls,[]);
 s.ready.hearts=true;tick();assert.deepEqual(calls,['clear','depth','hearts'],'ready gift resumes immediately');
}
delete globalThis.devicePixelRatio;
console.log('PASS idle clear-once, resize/DPR, first frame, layering and ending fragments (mock GPU calls)');
