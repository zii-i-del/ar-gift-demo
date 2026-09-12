import assert from 'node:assert/strict';
import fs from 'node:fs';
import {heartClipTime,heartOpacity} from '../lib/heart-animation.ts';
const bytes=fs.readFileSync('public/assets/heart-rose-v3.glb');
const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert.equal(g.meshes.length,1);
assert.equal(g.accessors[g.meshes[0].primitives[0].indices].count/3,3072);
for(const m of g.materials){
 assert.equal(m.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0,0);
 assert.equal(m.alphaMode ?? 'OPAQUE','OPAQUE');
 assert.ok(m.pbrMetallicRoughness.baseColorTexture);
 assert.ok(m.extensions.KHR_materials_clearcoat.clearcoatFactor>0);
}
assert.ok(g.images.length>0 && g.images.every(i=>i.bufferView!==undefined),'textures embedded in GLB');
for(const life of [1.9,3]){
 assert.equal(heartOpacity(life-.251,life),1);
 assert.equal(heartOpacity(life,life),0);
 assert.ok(Math.abs(heartOpacity(life-.125,life)-.5)<1e-6);
 for(const age of [0,.12,.28,.48,.68,.82])assert.equal(heartClipTime(age,life),age);
}
console.log(`PASS: opaque textured rose GLB ${bytes.length} bytes, 3072 triangles; zero transmission, clearcoat, final 250ms fade, unchanged growth`);
