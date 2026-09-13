import assert from 'node:assert/strict';
import {makeOpticalMaterial,setBubbleUniforms} from '../lib/bubble-optics.js';

// GPU inputs only: material creation needs no renderer or camera.
const material=makeOpticalMaterial({});
for(const [width,height] of [[1280,720],[720,1280]]){
 for(const [age,pop,alpha,opening] of [[0,-1,0,-1],[.05,-1,.5,-1],[1,.06,1,1.1],[1,.32,1,1.1]]){
  const bubble=Object.freeze({age,pop,r:24});
  setBubbleUniforms(material,bubble,width,height,1.5,7);
  const u=material.uniforms;
  assert.deepEqual(u.uResolution.value.toArray(),[width*1.5,height*1.5]);
  assert.equal(u.uTime.value,age);assert.equal(u.uSeed.value,7);
  assert.equal(u.uRadiusPx.value,36);assert.equal(u.uBirthAlpha.value,alpha);
  assert.equal(u.uOpening.value,opening);
  assert.equal(u.uRefraction.value,.05);assert.equal(u.uFilmStrength.value,.78);
  assert.equal(u.uHighlightStrength.value,1.4);
 }
}
material.dispose();
console.log('PASS bubble growth, rupture and optical inputs remain unchanged');
