import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {orderHearts,heartDepthLayout} from '../lib/heart-presentation.ts';
import {heartClipTime} from '../lib/heart-animation.ts';
import {heartFinish,heartSquash,HEART_SETTLE} from '../lib/heart-response.ts';
import {HEART_CAPACITY,HEART_LIFETIME} from '../lib/heart-flow.ts';

function subject(source){
 const body=source.slice(source.indexOf('  draw('),source.indexOf('  dispose(){'));
 const code=ts.transpileModule(`class Subject{${body}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const Subject=new Function('orderHearts','heartDepthLayout','heartClipTime','heartFinish','heartSquash','HEART_SETTLE','HEART_CAPACITY','HEART_LIFETIME',code+';return Subject;')(orderHearts,heartDepthLayout,heartClipTime,heartFinish,heartSquash,HEART_SETTLE,HEART_CAPACITY,HEART_LIFETIME);
 const s=new Subject();
 Object.assign(s,{ready:true,shared:true,lightweight:true,videoPlane:new THREE.Mesh(),ordered:[],ranks:[],modelRadius:1,renderSize:new THREE.Vector2(),camera:new THREE.OrthographicCamera(),bodyCenter:new THREE.Vector3(.1,.3,.05),centerOffset:new THREE.Vector3(),turnOffset:new THREE.Vector3(),renderer:{getSize:v=>v.set(640,360),setSize(){},render(){}},motes:new THREE.InstancedMesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial(),96),motePose:new THREE.Object3D(),moteAlpha:new THREE.InstancedBufferAttribute(new Float32Array(96),1),moteKind:new THREE.InstancedBufferAttribute(new Float32Array(96),1),pinkMote:new THREE.Color(0xffaac5),yellowMote:new THREE.Color(0xffdf8c),petalSample:{}});
 s.slots=Array.from({length:12},()=>({root:new THREE.Group(),axis:new THREE.Group(),unrotate:new THREE.Group(),mixer:{setTime(t){this.time=t;}},meshes:[{}],materials:[{userData:{baseOpacity:1}}],peach:[{userData:{baseOpacity:1}}]}));
 return s;
}

// Test-only historical source; never bundled into the live page.
import {execFileSync} from 'node:child_process';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Interaction} from '../lib/interaction.ts';
const sources=[execFileSync('git',['show','e4cedd3:lib/heart-renderer.ts'],{encoding:'utf8'}),fs.readFileSync('lib/heart-renderer.ts','utf8')];
let frames=0,maxDelta=0,maxHandoff=0;
for(const color of ['pink','yellow']){
 const bytes=fs.readFileSync(`public/assets/heart-crystal-v21-${color}.glb`);
 const gltf=await new GLTFLoader().register(()=>({name:'CPUTexture',loadTexture:()=>Promise.resolve(new THREE.Texture())})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const clip=gltf.animations.find(c=>c.name==='Heart_Grow');
 for(const [w,h] of [[640,360],[360,640]])for(const moving of [false,true])for(const collision of [false,true]){
  const views=sources.map(source=>{
   const s=subject(source),model=gltf.scene.clone(true),body=model.getObjectByName('Heart_Glass');
   const inspect=new THREE.AnimationMixer(model);inspect.clipAction(clip).play();inspect.setTime(.82);model.updateMatrixWorld(true);
   new THREE.Box3().setFromObject(body,true).getCenter(s.bodyCenter);inspect.stopAllAction();inspect.uncacheRoot(model);
   const slot=s.slots[0];slot.axis.position.copy(s.bodyCenter);model.position.sub(s.bodyCenter);slot.unrotate.add(model);slot.axis.add(slot.unrotate);slot.root.add(slot.axis);
   slot.mixer=new THREE.AnimationMixer(model);const action=slot.mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
   return {s,body};
  });
  const e=new Interaction();e.width=w;e.height=h;
  const hand=t=>({id:'L',tip:{x:w*.4,y:h*.6},heartOrigin:{x:w*.4+(moving?t*.08:0),y:h*.6},heartDirection:{x:0,y:-1},anchor:{x:w*.4,y:h*.6},wrist:{x:w*.4,y:h*.6+80},span:60,heart:true,palm:false,pointing:false,reach:0});
  e.acceptHands([hand(0)],0);e.acceptHands([hand(100)],100);e.step(0,100);assert.ok(e.hearts[0].active);e.autoReady.hearts=false;
  let previous;
  for(let n=0;n<=50;n++){
   const now=100+n*1000/60;
   if(n){if(n%4===0)e.acceptHands([hand(now)],now);e.acceptHead(collision?{x:w*.4,y:h*.6-90,rx:45,ry:60,angle:0,vx:0,vy:0,omega:0,timestamp:now,reset:false}:null);e.step(1/60,now);}
   const bounds=views.map(({s,body},index)=>{
    if(index===0)s.draw(e.hearts,w,h,undefined,undefined,undefined,[],e.heartPetals);else s.draw(e.hearts,w,h,undefined,undefined,e.heartPetals);
    s.slots[0].root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(body,true);
    return [...box.getCenter(new THREE.Vector3()).toArray(),...box.getSize(new THREE.Vector3()).toArray()];
   });
   bounds[0].forEach((v,j)=>{maxDelta=Math.max(maxDelta,Math.abs(v-bounds[1][j]));});
   if(previous&&n>=5&&n<=7)maxHandoff=Math.max(maxHandoff,Math.hypot(bounds[1][0]-previous[0],bounds[1][1]-previous[1]));
   previous=bounds[1];frames++;
  }
  views.forEach(({s})=>s.slots[0].mixer.stopAllAction());
 }
}
assert.ok(maxDelta<1e-9,`real-model bounds differ: ${maxDelta}`);
console.log(JSON.stringify({frames,maxBoundsDifferencePx:maxDelta,maxCenterStepNear100ms:maxHandoff}));
console.log('PASS real GLB birth bounds match e4cedd3: both colors/orientations, moving hand, face collision');
