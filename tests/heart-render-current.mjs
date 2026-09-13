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
 Object.assign(s,{ready:true,shared:true,ordered:[],ranks:[],modelRadius:1,renderSize:new THREE.Vector2(),camera:new THREE.OrthographicCamera(),bodyCenter:new THREE.Vector3(.1,.3,.05),centerOffset:new THREE.Vector3(),turnOffset:new THREE.Vector3(),renderer:{getSize:v=>v.set(640,360),setSize(){},render(){}},motes:new THREE.InstancedMesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial(),96),motePose:new THREE.Object3D(),moteAlpha:new THREE.InstancedBufferAttribute(new Float32Array(96),1),moteKind:new THREE.InstancedBufferAttribute(new Float32Array(96),1),pinkMote:new THREE.Color(0xffaac5),yellowMote:new THREE.Color(0xffdf8c),petalSample:{}});
 s.slots=Array.from({length:12},()=>({root:new THREE.Group(),axis:new THREE.Group(),unrotate:new THREE.Group(),mixer:{setTime(t){this.time=t;}},meshes:[{}],materials:[{userData:{baseOpacity:1}}],peach:[{userData:{baseOpacity:1}}]}));
 return s;
}
const source=fs.readFileSync('lib/heart-renderer.ts','utf8'),s=subject(source),snapshots=[];
const petals={groups:[{active:true,count:2}],sample(g,j,out){return Object.assign(out,{x:250+j*20,y:80,radius:6,angle:j*.3,alpha:.8,kind:j,color:j});}};
for(const [w,h] of [[640,360],[360,640]])for(const age of [.1,.82,1.2,1.55,1.7,1.85,2]){
 const hearts=Array.from({length:12},(_,i)=>({active:true,x:180+i*12,y:150,age,size:40+i*5,angle:.4,motionAngle:.2,appearanceAngle:.1,colorOrder:i,birthOrder:i,hitAngle:.3,squash:.1}));
 s.draw(hearts,w,h,undefined,undefined,petals);
 snapshots.push({projection:s.camera.projectionMatrix.toArray(),slots:s.slots.map(p=>({visible:p.root.visible,position:p.root.position.toArray(),rotation:p.root.rotation.toArray(),scale:p.root.scale.toArray(),axis:p.axis.scale.toArray(),axisAngle:p.axis.rotation.z,time:p.mixer.time,accent:p.meshes[0].material===p.peach[0]})),count:s.motes.count,matrices:Array.from(s.motes.instanceMatrix.array).slice(0,32),colors:Array.from(s.motes.instanceColor.array).slice(0,6)});
}
const fixture='tests/fixtures/heart-render-current.json';
assert.deepEqual(JSON.parse(JSON.stringify(snapshots)),JSON.parse(fs.readFileSync(fixture,'utf8')));
console.log('PASS current heart transforms, animation, colors and petals match pre-cleanup rendering in both orientations');
