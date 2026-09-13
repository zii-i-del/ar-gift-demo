import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {heartDepthLayout,orderHearts} from '../lib/heart-presentation.ts';

const source=fs.readFileSync('lib/heart-renderer.ts','utf8');
const prefix=source.slice(source.indexOf('  draw('),source.indexOf('    let moteCount=0;'))+'}';
const code=ts.transpileModule(`class Subject{${prefix}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const Subject=new Function('heartDepthLayout','orderHearts','HEART_LIFETIME',code+';return Subject;')(heartDepthLayout,orderHearts,1.9);
const s=new Subject();Object.assign(s,{ready:true,shared:true,renderSize:new THREE.Vector2(),ordered:[],ranks:[],modelRadius:1,videoPlane:new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial()),camera:new THREE.OrthographicCamera(-1,1,1,-1,.1,2000),renderer:{getSize:v=>v.set(640,360),setSize(){}}});
let updates=0;const update=s.camera.updateProjectionMatrix.bind(s.camera);s.camera.updateProjectionMatrix=()=>{updates++;update();};
const h=[{active:true,age:.2,size:40,birthOrder:0}];
function check(w,hgt){
 s.draw(h,w,hgt);const depth=heartDepthLayout(Math.max(0,...h.filter(p=>p.active&&p.age<1.9).map(p=>p.size))/2,h.filter(p=>p.active&&p.age<1.9).length);
 const expected=new THREE.OrthographicCamera(-w/2,w/2,hgt/2,-hgt/2,.1,depth.far);
 assert.deepEqual(s.camera.projectionMatrix.elements,expected.projectionMatrix.elements);
 assert.equal(s.camera.position.z,depth.cameraZ);
}
check(640,360);const first=updates;for(let n=0;n<60;n++)check(640,360);assert.equal(updates,first);
h[0].size=300;check(640,360);assert.equal(updates,first+1);
for(let n=1;n<12;n++)h.push({...h[0],birthOrder:n});check(640,360);assert.equal(updates,first+2);
check(360,640);assert.equal(updates,first+3);
h.forEach(p=>p.active=false);check(360,640);assert.equal(updates,first+4);
for(const [file,start,end,kind] of [
 ['lib/confetti-renderer.ts','    if (this.camera.right','    // Contact layer','star'],
 ['lib/bubble-renderer.ts','if(this.camera.right','    this.plane.scale','bubble'],
]){
 const text=fs.readFileSync(file,'utf8'),body=text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
 const run=new Function('c','width','height',body),subject={camera:new THREE.OrthographicCamera(0,1,0,1,.1,10),videoVersion:10};
 let count=0;const fn=subject.camera.updateProjectionMatrix.bind(subject.camera);subject.camera.updateProjectionMatrix=()=>{count++;fn();};
 for(const [w,hgt] of [[640,360],[360,640]]){
  const before=count;for(let n=0;n<60;n++)run.call(subject,{width:w,height:hgt},w,hgt);assert.equal(count,before+1);
  const expected=kind==='star'?new THREE.OrthographicCamera(0,w,0,hgt,.1,10):new THREE.OrthographicCamera(-w/2,w/2,hgt/2,-hgt/2,.1,10);
  assert.deepEqual(subject.camera.projectionMatrix.elements,expected.projectionMatrix.elements);
 }
 if(kind==='bubble')assert.equal(subject.videoVersion,-1);
}
console.log('PASS unchanged frames skip projection, dimensions/count/max-size changes retain exact matrices');
