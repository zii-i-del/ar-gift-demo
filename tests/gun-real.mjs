import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readHand,Interaction} from '../lib/interaction.ts';
const samples=JSON.parse(fs.readFileSync(new URL('./fixtures/gun-real-landmarks.json',import.meta.url)));
for(const sample of samples)for(const mirror of [false,true]){
 const raw=sample.raw.map((v,i)=>mirror&&i%3===0?1-v:v);
 const h=readHand(raw,'test',sample.width,sample.height,sample.width,sample.height,sample.world);
 assert.equal(h.gun,sample.expected,`${sample.name}: ${h.gunReason}`);
 const e=new Interaction();e.reset('bubble');
 for(let i=0;i<90;i++){const now=i*1000/60;if(i%4===0)e.acceptHands([h],now);e.step(1/60,now);}
 assert.equal(e.emittedBubbles>0,sample.expected);
 console.log(sample.name,mirror?'mirrored':'original',h.gunReason,h.indexBends.map(Math.round));
}
console.log('PASS: actual screenshot landmarks; image-mode samples are not live-video accuracy certification');
