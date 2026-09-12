import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readHand} from '../lib/interaction.ts';
const samples=JSON.parse(fs.readFileSync(new URL('./fixtures/gun-video-g5.json',import.meta.url)));
for(const s of samples)for(const mirror of [false,true]){
 const raw=s.raw.map((v,i)=>mirror&&i%3===0?1-v:v);
 const h=readHand(raw,'test',640,480,640,480,s.world);
 assert.equal(h.gun,s.expected,`${s.time}: ${h.gunReason}`);
}
console.log('PASS: labelled replay frames at 17/23/29/35s and mirrored poses; not camera accuracy certification');
