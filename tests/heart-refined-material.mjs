import fs from 'node:fs';
import assert from 'node:assert/strict';
function read(name){const b=fs.readFileSync(`public/assets/${name}.glb`);const n=b.readUInt32LE(12);return {j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n),size:b.length}}
const before=read('heart-rose-v3'),after=read('heart-refined-v4');
function data(g,i){const a=g.j.accessors[i],v=g.j.bufferViews[a.bufferView];return g.bin.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+v.byteLength)}
const a=before.j.meshes[0].primitives[0],b=after.j.meshes[0].primitives[0];
for(const name of ['POSITION','NORMAL','TEXCOORD_0'])assert.deepEqual(data(before,a.attributes[name]),data(after,b.attributes[name]),`${name} unchanged`);
assert.deepEqual(data(before,a.indices),data(after,b.indices));
assert.equal(after.j.accessors[b.indices].count/3,3072);
for(let i=0;i<before.j.animations[0].samplers.length;i++)for(const key of ['input','output'])assert.deepEqual(data(before,before.j.animations[0].samplers[i][key]),data(after,after.j.animations[0].samplers[i][key]),'animation unchanged');
const m=after.j.materials[0];assert.equal(m.alphaMode??'OPAQUE','OPAQUE');assert.equal(m.extensions?.KHR_materials_transmission?.transmissionFactor??0,0);
assert.ok(m.pbrMetallicRoughness.baseColorTexture);assert.equal(m.emissiveTexture,undefined,'emission must be uniform');
assert.equal(after.j.images.length,1);
console.log(`PASS: ${after.size} bytes; identical 3072-triangle geometry, normals, UVs and animation; one color texture, uniform emission, opaque, zero transmission`);
