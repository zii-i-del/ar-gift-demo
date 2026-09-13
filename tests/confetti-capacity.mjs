import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {Confetti} from '../lib/confetti.ts';
import {CONFETTI_CAPACITY} from '../lib/confetti-config.ts';
import {STAR_POINTS} from '../lib/confetti-star.ts';

// Construct real Three.js buffers with a shared renderer stub; no GPU required.
const source=fs.readFileSync('lib/confetti-renderer.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace('export class ConfettiRenderer','class ConfettiRenderer');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const Renderer=new Function('THREE','CONFETTI_CAPACITY','STAR_POINTS',compiled+';return ConfettiRenderer;')(THREE,CONFETTI_CAPACITY,STAR_POINTS);
const renderer=new Renderer({setClearColor(){}});
assert.equal(CONFETTI_CAPACITY,160);
assert.equal(renderer.mesh.instanceMatrix.count,CONFETTI_CAPACITY);
assert.equal(renderer.style.count,CONFETTI_CAPACITY);
assert.equal(renderer.flip.count,CONFETTI_CAPACITY);
for(const [w,h,total] of [[640,360,160],[360,640,100]]){
 const c=new Confetti();c.resize(w,h,w,h);c.modelReady=true;
 const pool=c.particles;
 for(let round=0;round<3;round++){
  const start=1000+round*8000;assert.equal(c.trigger(start),true);
  for(let frame=0;frame<=420;frame++)c.step(1/60,start+frame*1000/60);
  assert.equal(c.emitted,total);assert.equal(c.active,0);
  assert.equal(c.particles,pool);assert.equal(pool.length,CONFETTI_CAPACITY);
 }
}
console.log('PASS shared star capacity and repeated full rounds in both orientations');
