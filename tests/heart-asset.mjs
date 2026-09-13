import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {heartClipTime,heartOpacity} from '../lib/heart-animation.ts';
for(const color of ['pink','yellow']){
const bytes=fs.readFileSync(`public/assets/heart-crystal-v21-${color}.glb`);
// CPU test uses the loader's texture hook; image decoding is not exercised.
const g=await new GLTFLoader().register(()=>({name:'CPUTexture',loadTexture:()=>Promise.resolve(new THREE.Texture())})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const clip=g.animations.find(c=>c.name==='Heart_Grow');assert.ok(clip);assert.equal(clip.duration,3);
const meshes=[];g.scene.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite));if(o.isMesh)meshes.push(o)});
assert.equal(meshes.length,1);const mesh=meshes[0];assert.equal(mesh.geometry.index.count/3,4416);
mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
assert.ok(Math.abs(box.min.y)<1e-6);assert.ok(Math.abs(box.max.x-box.min.x-2)<1e-5);
const geometry=new Set(),materials=[];
for(let slot=0;slot<12;slot++){
 const model=g.scene.clone(true);model.traverse(o=>{if(o.isMesh){geometry.add(o.geometry);o.material=o.material.clone();materials.push(o.material)}});
 const rig=model.getObjectByName('Heart_Rig'),mixer=new THREE.AnimationMixer(model),a=mixer.clipAction(clip);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();
 for(let round=0;round<20;round++)for(const life of [1.9,3]){
  for(const [age,expected] of [[0,.04],[.12,.15],[.28,.4],[.48,.75],[.68,1.04],[.82,1]]){
   mixer.setTime(heartClipTime(age,life));assert.ok(Math.abs(rig.scale.x-expected)<.001,`${age}: ${rig.scale.x}`);
  }
  mixer.setTime(heartClipTime(life-.001,life));assert.equal(heartOpacity(life,life),0);
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);
}
assert.equal(geometry.size,1);assert.equal(materials.length,12);materials.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());
console.log(`PASS: ${bytes.length} bytes, 4416 triangles, single mesh, bottom pivot, 12 shared-geometry instances × 20 replay cycles; growth uncompressed for 1.9s and 3s lifetimes`);

}

for(const life of [1.9,3]){
 assert.equal(heartOpacity(life-.251,life),1);
 assert.equal(heartOpacity(life,life),0);
 assert.ok(Math.abs(heartOpacity(life-.125,life)-.5)<1e-6);
 for(const age of [0,.12,.28,.48,.68,.82])assert.equal(heartClipTime(age,life),age);
}
