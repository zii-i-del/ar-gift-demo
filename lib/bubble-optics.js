import * as THREE from 'three';
// Asset-side reference material, not a modification of the AR application.
export const BUBBLE_OPTICS_VERSION='1.4.0';
export const vertexShader=`
#include <common>
#include <morphtarget_pars_vertex>
varying vec3 vNormalView;
varying vec3 vLocal;
void main(){
 #include <beginnormal_vertex>
 #include <morphnormal_vertex>
 #include <begin_vertex>
 #include <morphtarget_vertex>
 vNormalView=normalize(normalMatrix*objectNormal);
 vLocal=normalize(position);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.0);
}`;
export const fragmentShader=`
precision highp float;
uniform sampler2D uBackground,uFilmMatcap,uHighlightMatcap;
uniform vec2 uResolution;
uniform float uTime,uSeed,uRadiusPx,uRefraction,uFilmStrength,uHighlightStrength,uOpening,uBirthAlpha;
uniform vec3 uPopAxis;
varying vec3 vNormalView,vLocal;
const float PI=3.141592653589793;
void main(){
 float azimuth=atan(vLocal.y,vLocal.x);
 float edgeVariation=1.0+.035*sin(7.0*azimuth+.4)+.022*sin(13.0*azimuth-1.0);
 float radial=length(vLocal.xy);
 float hole=uOpening*edgeVariation;
 if(uOpening>=0.0 && radial<hole)discard;
 vec3 n=normalize(vNormalView);float facing=clamp(n.z,0.012,1.0);
 // Front orthographic normal-space lookup matches the Blender camera capture.
 vec2 surface=n.xy;
 float len=length(surface);surface*=min(1.0,.994/max(.001,len));
 vec2 matUV=surface*.5+.5;
 // Only the broad color field moves, leaving studio highlights stable.
 vec2 drift=vec2(sin(uTime*.28+uSeed*.31),cos(uTime*.23+uSeed*.27))*.007*facing;
 vec3 film=texture2D(uFilmMatcap,clamp(matUV+drift,vec2(.003),vec2(.997))).rgb;
 vec3 highlight=texture2D(uHighlightMatcap,matUV).rgb;
 vec2 uv=gl_FragCoord.xy/uResolution;
 vec2 bend=n.xy*(1.0-facing)*uRadiusPx*uRefraction/uResolution;
 vec3 behind=texture2D(uBackground,clamp(uv+bend,vec2(.001),vec2(.999))).rgb;
 float filmWeight=clamp(uFilmStrength+.15*pow(1.0-facing,2.0),0.0,.95);
 vec3 color=mix(behind,film,filmWeight);
 // Screen-like linear blend protects saturated film from an additive white wash.
 color=mix(color,vec3(1.0),clamp(highlight*uHighlightStrength,vec3(0.0),vec3(1.0)));
 // Thin luminous liquid edge belongs to the remaining film, never a separate full torus.
 if(uOpening>0.0){
  float edge=(1.0-smoothstep(.002,.014,radial-hole));
  float breakup=.5+.5*sin(11.0*azimuth+1.2);
  color+=edge*mix(vec3(.24,.40,.65),vec3(.65,.20,.38),breakup)*.65;
 }
 gl_FragColor=vec4(color,uBirthAlpha);
 #include <colorspace_fragment>
}`;
export function makeOpticalMaterial(shared){
 return new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,side:THREE.FrontSide,
  uniforms:{uBackground:{value:shared.background},uFilmMatcap:{value:shared.film},uHighlightMatcap:{value:shared.highlight},
   uResolution:{value:new THREE.Vector2(1,1)},uTime:{value:0},uSeed:{value:0},uRadiusPx:{value:48},uRefraction:{value:.05},uFilmStrength:{value:.78},uHighlightStrength:{value:1.4},uOpening:{value:-1},uBirthAlpha:{value:1},uPopAxis:{value:new THREE.Vector3(0,0,1)}}});
}
export function setBubbleUniforms(material,state,width,height,pixelRatio,birthId){
 const u=material.uniforms;u.uResolution.value.set(width*pixelRatio,height*pixelRatio);u.uTime.value=state.age;
 u.uSeed.value=birthId;u.uRadiusPx.value=state.r*pixelRatio;u.uBirthAlpha.value=Math.min(1,state.age/.10);
 u.uOpening.value=state.pop>=0?Math.min(1.10,1.10*Math.pow(state.pop/.06,.80)):-1;
}
// Preallocated drops depart from the last irregular membrane edge. No expanding torus.
export function makeRuptureGeometry(){return {drop:new THREE.IcosahedronGeometry(1,0)};}
export function makeRuptureController(geometries,environment){
 const root=new THREE.Group();
 const mat=new THREE.MeshPhysicalMaterial({color:0xddeeff,roughness:.08,clearcoat:1,envMap:environment,envMapIntensity:1.4,transparent:true,opacity:1});
 const drops=Array.from({length:5},()=>{const m=new THREE.Mesh(geometries.drop,mat);root.add(m);return m;});
 const records=drops.map((_,i)=>{const a=i*2.399+.23;
  const variation=1+.035*Math.sin(7*a+.4)+.022*Math.sin(13*a-1);
  const radius=.94,time=.06*Math.pow(radius/(1.1*variation),1/.8);
  const position=new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,Math.sqrt(1-radius*radius));
  const velocity=new THREE.Vector3(Math.cos(a)*1.4,Math.sin(a)*1.4,.35);
  return {time,position,velocity,size:.009+i*.0015};
 });
 return {root,update(pop){
  root.visible=pop>=0&&pop<.32;if(!root.visible)return;
  mat.opacity=pop<.13?1:Math.max(0,(.32-pop)/.19);
  drops.forEach((d,i)=>{const r=records[i],age=pop-r.time;d.visible=age>=0;if(!d.visible)return;
   d.position.copy(r.position).addScaledVector(r.velocity,age);d.position.y-=age*age*1.2;
   d.scale.set(r.size,r.size*(1+Math.max(0,.04-age)*15),r.size);
  });
 },dispose(){mat.dispose();root.clear();}};
}
