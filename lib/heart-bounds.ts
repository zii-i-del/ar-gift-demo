import * as THREE from 'three';
/** Conservative radius about the model origin; valid for all rotations in its clip.
 * Current GLBs use linear scale/rotation tracks and rigid meshes. Computed at load only.
 */
export function animatedHeartRadius(root:THREE.Object3D,clip:THREE.AnimationClip){
 const scales=new Map<THREE.Object3D,number>(),translations=new Map<THREE.Object3D,number>();
 for(const track of clip.tracks){
  const binding=THREE.PropertyBinding.parseTrackName(track.name);
  const node=THREE.PropertyBinding.findNode(root,binding.nodeName);if(!(node instanceof THREE.Object3D))continue;
  if(binding.propertyName==='scale'){
   let m=0;for(const v of track.values)m=Math.max(m,Math.abs(v));scales.set(node,m);
  }else if(binding.propertyName==='position'){
   let m=0;for(let i=0;i<track.values.length;i+=3)m=Math.max(m,Math.hypot(track.values[i],track.values[i+1],track.values[i+2]));translations.set(node,m);
  }
 }
 function bound(node:THREE.Object3D):number{
  let radius=0;
  if(node instanceof THREE.Mesh){node.geometry.computeBoundingSphere();const sphere=node.geometry.boundingSphere;if(sphere)radius=sphere.center.length()+sphere.radius;}
  for(const child of node.children)radius=Math.max(radius,bound(child));
  const scale=Math.max(scales.get(node)??0,Math.abs(node.scale.x),Math.abs(node.scale.y),Math.abs(node.scale.z));
  return radius*scale+Math.max(translations.get(node)??0,node.position.length());
 }
 return Math.max(.01,bound(root))*1.01;
}
