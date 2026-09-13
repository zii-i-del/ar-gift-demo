import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

// Execute the production methods with real Three.js assets, without a GPU.
const source=ts.createSourceFile('heart.ts',fs.readFileSync('lib/heart-renderer.ts','utf8'),ts.ScriptTarget.Latest,true);
const cls=source.statements.find(ts.isClassDeclaration);
const methods=['load','dispose','restoreEstablishedMaterial'].map(name=>cls.members.find(m=>m.name?.getText(source)===name).getText(source)).join('\n');
const compiled=ts.transpileModule(`class Subject {${methods}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let pending=[];
class Loader {loadAsync(url){return new Promise((resolve,reject)=>pending.push({url,resolve,reject}));}}
const Subject=new Function('THREE','GLTFLoader','animatedHeartRadius','HEART_CAPACITY',compiled+'; return Subject;')(THREE,Loader,()=>1,2);
function subject(){
 const s=new Subject();Object.assign(s,{disposed:false,ready:false,slots:[],assetTextures:new Set(),bodyCenter:new THREE.Vector3(),scene:new THREE.Scene(),motes:new THREE.Mesh(),environment:{dispose(){}},shared:true});return s;
}
function asset(animation=true,color=0xffaac5){
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),material=new THREE.MeshPhysicalMaterial({color,map:texture,emissiveMap:texture});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Heart_Glass';const scene=new THREE.Group();scene.add(mesh);
 const counts={geometry:0,material:0,texture:0};for(const [key,value] of Object.entries({geometry,material,texture}))value.addEventListener('dispose',()=>counts[key]++);
 return {scene,animations:animation?[new THREE.AnimationClip('Heart_Grow',1,[])]:[],counts};
}
// Close before the first asset arrives: all source resources are released once.
{
 const s=subject(),a=asset(),loading=s.load();s.dispose();pending.shift().resolve(a);await loading;
 assert.deepEqual(a.counts,{geometry:1,material:1,texture:1});assert.equal(s.ready,false);assert.equal(pending.length,0);
}
// Close during the second asset: both late source assets must be released.
{
 const s=subject(),a=asset(),b=asset(),loading=s.load();pending.shift().resolve(a);await Promise.resolve();
 assert.equal(pending.length,1);s.dispose();pending.shift().resolve(b);await loading;
 for(const item of [a,b])assert.deepEqual(item.counts,{geometry:1,material:1,texture:1});assert.equal(s.slots.length,0);
}
// Missing animation and failed second download clean up the completed asset.
{
 const s=subject(),a=asset(false),loading=s.load();pending.shift().resolve(a);await assert.rejects(loading,/animation missing/);
 assert.deepEqual(a.counts,{geometry:1,material:1,texture:1});s.dispose();
}
{
 const s=subject(),a=asset(),loading=s.load();pending.shift().resolve(a);await Promise.resolve();pending.shift().reject(Error('network'));
 await assert.rejects(loading,/network/);s.dispose();assert.deepEqual(a.counts,{geometry:1,material:1,texture:1});
}
// Normal load transfers shared resources to the renderer until it closes.
{
 const s=subject(),a=asset(),b=asset(true,0xffdf8c),loading=s.load();
 assert.equal(pending[0].url,'/assets/heart-crystal-v21-pink.glb');pending.shift().resolve(a);await Promise.resolve();
 assert.equal(pending[0].url,'/assets/heart-crystal-v21-yellow.glb');pending.shift().resolve(b);await loading;
 assert.equal(s.ready,true);assert.equal(s.slots.length,2);
 for(const slot of s.slots)for(const material of [...slot.materials,...slot.peach]){
  assert.equal(material.roughness,.13);assert.equal(material.clearcoat,.65);assert.equal(material.clearcoatRoughness,.13);
  assert.equal(material.transmission,0);assert.equal(material.thickness,0);
  assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.side,THREE.FrontSide);
 }
 for(const slot of s.slots){
  assert.equal(slot.materials[0].color.getHex(),0xffaac5);assert.equal(slot.peach[0].color.getHex(),0xffdf8c);
  assert.equal(slot.materials[0].userData.baseOpacity,1);assert.equal(slot.peach[0].userData.baseOpacity,1);
 }
 assert.notEqual(s.slots[0].materials[0],s.slots[1].materials[0]);
 assert.notEqual(s.slots[0].peach[0],s.slots[1].peach[0]);
 assert.deepEqual(a.counts,{geometry:0,material:1,texture:0});assert.deepEqual(b.counts,{geometry:1,material:1,texture:0});
 s.dispose();s.dispose();for(const item of [a,b])assert.deepEqual(item.counts,{geometry:1,material:1,texture:1});
}
console.log('PASS late assets, second-load cancellation/failure, missing animation, texture ownership and normal disposal');

// Exercise the actual page completion guard under deliberately reversed loads.
const page=fs.readFileSync('app/page.tsx','utf8');
const create=page.slice(page.indexOf('  const createRenderer=async'),page.indexOf('  void createRenderer().catch')).replace("const {GiftRenderer}=await import('../lib/gift-renderer');",'');
const runtime=ts.transpileModule(`
 let disposed=false,renderer=null,worker=null,busy=false,next=0,workerReady=false;
 const v={},id=1,i={},updates=[],errors=[],root={appendChild(){}},onLost=()=>{},recoverRenderer=()=>{},receive=()=>{};
 const setReady=value=>updates.push(value),setError=value=>errors.push(value);
 ${create}
 return {createRenderer,close(){disposed=true;renderer?.dispose();},get renderer(){return renderer;},updates,errors};
`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let workers=0;
class FakeRenderer{
 ready={hearts:true,bubble:true};errors={};disposed=false;
 renderer={domElement:{style:{},addEventListener(){}},getContext(){return {};}};
 load(){return new Promise(resolve=>{this.finish=resolve;});}dispose(){this.disposed=true;}
}
const setup=()=>new Function('GiftRenderer','Worker',runtime)(FakeRenderer,class{constructor(){workers++;}postMessage(){}});
{
 const r=setup(),first=r.createRenderer(),old=r.renderer;old.dispose();
 const second=r.createRenderer(),current=r.renderer;old.finish();await first;
 assert.equal(r.updates.length,0);assert.equal(workers,0);
 current.finish();await second;assert.equal(r.updates.length,1);assert.equal(workers,1);
 const third=r.createRenderer();r.renderer.finish();await third;assert.equal(workers,1,'rebuild does not duplicate the worker');
}
{
 const r=setup(),loading=r.createRenderer(),old=r.renderer;r.close();old.finish();await loading;
 assert.equal(r.updates.length,0);assert.equal(r.errors.length,0);assert.equal(workers,1);
}
console.log('PASS obsolete completion ignored, current renderer starts one worker, closed session stays closed');
