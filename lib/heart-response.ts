import type { Heart } from './interaction.ts';
import { heartFallbackScale } from './heart-animation.ts';
import { HEART_LIFETIME } from './heart-flow.ts';
import { collideHead, type HeadState } from './head.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};
export const HEART_SETTLE=.38;
export function heartFinish(age:number,lifetime=HEART_LIFETIME){
  const t=age-(lifetime-HEART_SETTLE);
  if(t<=0)return 1;
  if(t<.09)return 1+.025*smooth(t/.09);
  return 1.025*(1-smooth((t-.09)/.23));
}
export function heartBodyScale(age:number,lifetime=HEART_LIFETIME){
  return heartFallbackScale(Math.min(age,lifetime-HEART_SETTLE),lifetime)*heartFinish(age,lifetime);
}
// The model has a bottom pivot. Contacts and the finale use its visual centre.
export function heartCenter(h:Heart,age=h.age,out={x:0,y:0},x=h.x,y=h.y){
  const angle=h.appearanceAngle??h.angle??0,launch=h.angle??0;
  const offset=h.size*.42*heartFallbackScale(Math.min(age,HEART_LIFETIME-HEART_SETTLE),HEART_LIFETIME);
  out.x=x+Math.sin(launch)*8+Math.sin(angle)*offset;out.y=y-Math.cos(launch)*8-Math.cos(angle)*offset;return out;
}
const beforeScratch={x:0,y:0},centerScratch={x:0,y:0};
const contactScratch={x:0,y:0,vx:0,vy:0,r:0,age:0,contactX:NaN,contactY:NaN,hitAngle:0};
export function heartSquash(h:Heart){
  const t=(h.age-(h.contactAge??-100))/.25;
  return t<0||t>=1?0:(h.squashAmount??.1)*Math.sin(Math.PI*t)*Math.exp(-1.2*t);
}
export function collideHeart(h:Heart,px:number,py:number,body:HeadState,dt:number,now:number,w:number,height:number){
  if(h.age<.45||h.age>HEART_LIFETIME-HEART_SETTLE||h.age-(h.contactAge??-100)<.55||body.reset||now<body.timestamp||now-body.timestamp>160)return false;
  const before=heartCenter(h,Math.max(0,h.age-dt),beforeScratch,px,py),center=heartCenter(h,h.age,centerScratch);
  const c=Math.cos(body.angle),s=Math.sin(body.angle),dx=before.x-body.x,dy=before.y-body.y;
  // Never teleport a heart born over the face out to its perimeter.
  if(((c*dx+s*dy)/body.rx)**2+((-s*dx+c*dy)/body.ry)**2<1)return false;
  const r=h.size*.29*heartBodyScale(h.age);
  const b=contactScratch;b.x=center.x;b.y=center.y;b.vx=h.vx??0;b.vy=h.vy??0;b.r=r;b.age=h.age;b.contactX=NaN;b.contactY=NaN;b.hitAngle=0;
  collideHead(b,before.x,before.y,body,dt,now,w,height,r);
  if(!Number.isFinite(b.contactX)||Math.hypot(b.x-center.x,b.y-center.y)>Math.max(12,r*.65))return false;
  h.x+=b.x-center.x;h.y+=b.y-center.y;
  const nx=Math.cos(b.hitAngle),ny=Math.sin(b.hitAngle);
  const vx=(h.vx??0)-body.vx,vy=(h.vy??0)-body.vy,normal=vx*nx+vy*ny;
  const kick=Math.min(165,Math.max(105,-normal*.85));
  // Deliberate outward rebound, not bubble-like tangential sliding.
  h.vx=nx*kick+(vx-normal*nx)*.22;
  h.vy=ny*kick+(vy-normal*ny)*.22;h.hitAngle=b.hitAngle;
  const speed=Math.hypot(h.vx,h.vy);
  h.squashAmount=.15+Math.min(.09,speed/180*.09);h.contactAge=h.age;
  return true;
}
// Four deterministic, short-lived motes; no new recognition gesture or child hearts.
export function heartMote(age:number,size:number,index:number,seed:number,lifetime=HEART_LIFETIME){
  const t=(age-(lifetime-.15))/.42;
  const q=clamp(t),a=index*Math.PI*.5+seed*.73;
  const radius=size*(.07+.20*(1-(1-q)**2));
  return {x:Math.cos(a)*radius,y:Math.sin(a)*radius*.72-size*.08*q,
    radius:Math.max(3.5,Math.min(6,size*.055))*(1-.25*q),
    alpha:t<=0||t>=1?0:.95*smooth(q/.14)*(1-smooth((q-.5)/.5))};
}
