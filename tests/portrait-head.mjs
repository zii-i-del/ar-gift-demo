import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {Confetti} from '../lib/confetti.ts';

// Execute the production result intake, including the shared face path used by confetti.
const page=fs.readFileSync('app/page.tsx','utf8');
const body=page.slice(page.indexOf('    const now=performance.now();metrics'),page.indexOf("    if(p.task==='hands')"));
const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const receive=new Function('p','performance','metrics','c','i','readHead',code);
const c=new Confetti(),i={head:null,acceptHead(value){this.head=value;}};
const raw=Array(468*3).fill(.5);
let calls=0;
const head={timestamp:1000};
const read=()=>{calls++;return head;};
const packet={task:'face',timestamp:1000,duration:10,valid:true,faceLandmarks:raw};
function send(w,h,p=packet,now=1050){c.resize(w,h,1280,720);receive(p,{now:()=>now},{},c,i,read);}
send(640,360);assert.equal(calls,1);assert.equal(i.head,head);
send(360,640);assert.equal(calls,1);assert.equal(i.head,null);
assert.equal(c.face,raw,'portrait still receives face landmarks for mouth and hair tracking');
assert.equal(c.faceTime,1000);
send(640,360);assert.equal(calls,2);assert.equal(i.head,head);
send(640,360,packet,1201);assert.equal(calls,2);assert.equal(i.head,null);
send(640,360,{...packet,valid:false});assert.equal(calls,2);assert.equal(i.head,null);assert.equal(c.face,null);
console.log('PASS portrait skips collision construction, retains face intake; landscape and freshness preserved');
