import assert from 'node:assert/strict';
import {MouthRelease} from '../lib/mouth-release.ts';
const r=new MouthRelease(),away=id=>[{id,state:'away'}];
assert(!r.observe([],0,false));assert(!r.observe([],1000,false));
assert(!r.observe(away('new'),1100,false));assert(!r.observe(away('new'),1100,false));assert(r.observe(away('new'),1200,false));
r.reset();assert(!r.observe(away('A'),0,false));assert(!r.observe(away('B'),100,false),'different IDs cannot combine one observation each');assert(r.observe(away('B'),200,false));
r.reset();r.observe(away('A'),0,false);assert(!r.observe(away('A'),300,false),'long gaps restart continuity');
r.observe(away('A'),350,true);assert(!r.observe(away('A'),400,false),'covered gesture cancels release evidence');assert(r.observe(away('A'),500,false));
r.reset();r.observe(away('A'),0,false);assert(!r.observe(away('A'),80,false));assert(!r.observe([],100,false),'unobserved time cannot complete release');assert(!r.observe(away('A'),150,false));assert(r.observe(away('A'),200,false));
console.log('PASS independent release: duplicate, unknown track, ID continuity, tracking gap, cover reset and observed exit');

r.reset();r.observe(away('A'),0,false);r.observe(away('A'),50,false);
assert(!r.observe([{id:'A',state:'unknown'}],100,false));assert.equal(r.elapsedMs,50);
assert(!r.observe(away('A'),150,false));assert.equal(r.elapsedMs,50,'unknown gap pauses accumulation');
assert(r.observe(away('A'),200,false));
r.reset();r.observe(away('A'),0,false);r.observe([],100,false);assert(!r.observe(away('A'),250,false));assert.equal(r.elapsedMs,0);
console.log('PASS unknown pauses, exit does not accumulate, long loss restarts');
