import fs from 'node:fs';
import assert from 'node:assert/strict';
function read(name){const b=fs.readFileSync(`public/assets/${name}.glb`);const n=b.readUInt32LE(12);return {g:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const pink=read('heart-fresh-pink-v16'),peach=read('heart-honey-gold-v14');
function accessor(asset,id){const a=asset.g.accessors[id],v=asset.g.bufferViews[a.bufferView];return asset.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);}
const a=pink.g.meshes[0].primitives[0],b=peach.g.meshes[0].primitives[0];
for(const key of Object.keys(a.attributes))assert.deepEqual(accessor(pink,a.attributes[key]),accessor(peach,b.attributes[key]));
assert.deepEqual(accessor(pink,a.indices),accessor(peach,b.indices));
assert.equal(peach.g.accessors[b.indices].count/3,3072);
const clip=peach.g.animations.find(a=>a.name==='Heart_Grow');assert.ok(clip);
const old=pink.g.animations.find(a=>a.name==='Heart_Grow');
assert.deepEqual(clip.channels,old.channels);
clip.samplers.forEach((s,i)=>{assert.deepEqual(accessor(peach,s.input),accessor(pink,old.samplers[i].input));assert.deepEqual(accessor(peach,s.output),accessor(pink,old.samplers[i].output));});
assert.ok(peach.g.materials.every(m=>(m.alphaMode??'OPAQUE')==='OPAQUE'));
assert.ok(peach.g.materials.every(m=>!(m.extensions?.KHR_materials_transmission?.transmissionFactor)));
console.log('PASS: peach shares pink geometry/UV/animation data, 3072 triangles, opaque, no transmission');
