import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {animatedHeartRadius} from '../lib/heart-bounds.ts';
import {heartAppearanceAngle,orderHearts,heartDepthLayout} from '../lib/heart-presentation.ts';
const D=Math.PI/180;
for(const a of [-90,-30,0,30,90])for(const spread of [-12,0,12]){
 const base=heartAppearanceAngle(a*D-Math.PI/2,0),value=heartAppearanceAngle(a*D-Math.PI/2,spread*D);
 assert.ok(Math.abs(value-base)<=3*D+1e-8);assert.ok(Math.abs(value)<=30*D+1e-8);
 if(a===0)assert.ok(Math.abs(value-spread*D*.25)<1e-8);
}
const hearts=[{active:true,age:1,birthOrder:10},{active:true,age:.1,birthOrder:13},{active:true,age:.7,birthOrder:11}];const order=[];
assert.deepEqual(orderHearts(hearts,order,1.9),[0,2,1]);hearts[0].birthOrder=14;hearts[0].age=0;assert.deepEqual(orderHearts(hearts,order,1.9),[2,1,0]);hearts[2].age=1.91;assert.deepEqual(orderHearts(hearts,order,1.9),[1,0]);
for(const name of ['heart-rose-v3','heart-refined-v4','heart-vivid-v5']){
 const b=fs.readFileSync(new URL('../public/assets/'+name+'.glb',import.meta.url));const len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len)),bin=28+len;
 function floats(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type],values=[];for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)values.push(b.readFloatLE(bin+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+j*4));return values;}
 const nodes=g.nodes.map(n=>{let o=new THREE.Group();if(n.mesh!==undefined){const a=g.accessors[g.meshes[n.mesh].primitives[0].attributes.POSITION];const vertices=[];for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])vertices.push(x,y,z);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));o=new THREE.Mesh(geo);}o.name=n.name;if(n.scale)o.scale.fromArray(n.scale);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.translation)o.position.fromArray(n.translation);return o;});
 g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));const root=new THREE.Group();for(const i of g.scenes[g.scene||0].nodes)root.add(nodes[i]);
 const animation=g.animations[0],tracks=animation.channels.map(c=>{const s=animation.samplers[c.sampler],prop={rotation:'quaternion',scale:'scale',translation:'position'}[c.target.path];return new (prop==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(nodes[c.target.node].name+'.'+prop,floats(s.input),floats(s.output));});
 const clip=new THREE.AnimationClip('test',-1,tracks),radius=animatedHeartRadius(root,clip),mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();
 for(let t=0;t<3;t+=.05){mixer.setTime(t);root.updateMatrixWorld(true);for(const o of nodes)if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).length()<=radius+1e-5,'cached bound covers animation');}}
 for(const size of [40,80,144,300]){const r=radius*size/2,l=heartDepthLayout(r,12);assert.ok(l.spacing>2*r);assert.ok(11*l.spacing+r<l.cameraZ-.1);assert.ok(l.backgroundZ< -r);assert.ok(l.cameraZ-l.backgroundZ<l.far);}
 console.log('PASS: animated bounds and nonintersecting 12-layer layout',name);
}
console.log('PASS: birth order/reuse/expiry, independent bounded appearance angle');
