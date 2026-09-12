import type {Heart} from './interaction.ts';
import type {HeadState} from './head.ts';
import {collideHeart,heartCenter} from './heart-response.ts';
import {HEART_LIFETIME} from './heart-flow.ts';

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const centerScratch={x:0,y:0};
export function liteCenter(h:Heart,out=centerScratch){
 const a=h.appearanceAngle??h.angle??0,l=h.angle??0;
 out.x=h.x+Math.sin(l)*8+Math.sin(a)*h.size*.42;
 out.y=h.y-Math.cos(l)*8-Math.cos(a)*h.size*.42;return out;
}
export function stepHeartTurn(h:Heart,dt:number){
 if(h.contactAge===undefined)return;
 const elapsed=h.age-h.contactAge;
 const velocity=h.angularVelocity??0;
 h.motionAngle=clamp((h.motionAngle??0)+velocity*(1-Math.exp(-4*dt))/4,-.873,.873);
 h.angularVelocity=velocity*Math.exp(-4*dt);
 if(elapsed>.35&&h.contactReleased){
  h.vx=(h.vx??0)*Math.exp(-.65*dt);
  h.vy=(h.vy??0)+(-65-(h.vy??0))*(1-Math.exp(-2*dt));
 }
 // A lost tracker must not leave recovery permanently locked.
 if(elapsed>.65)h.contactReleased=true;
}
export function collideLiteHeart(h:Heart,px:number,py:number,b:HeadState,dt:number,now:number,w:number,height:number,id:string){
 if(h.contactBody===id&&!h.contactReleased){
  const p=liteCenter(h),dx=p.x-b.x,dy=p.y-b.y,c=Math.cos(b.angle),s=Math.sin(b.angle);
  const x=c*dx+s*dy,y=-s*dx+c*dy;
  const q=Math.hypot(x/b.rx,y/b.ry);
  if((q-1)*Math.min(b.rx,b.ry)>h.size*.49)h.contactReleased=true;
  return false;
 }
 const vx=h.vx??0,vy=h.vy??0;
 // Reuse the existing broad/narrow phase exactly once; no mesh collision.
 if(!collideHeart(h,px,py,b,dt,now,w,height))return false;
 const nx=Math.cos(h.hitAngle??0),ny=Math.sin(h.hitAngle??0);
 const rvx=vx-b.vx,rvy=vy-b.vy,dot=rvx*nx+rvy*ny;
 const kick=clamp(Math.max(h.size*1.8,-dot*.9),130,260);
 h.vx=nx*kick+(rvx-dot*nx)*.15;h.vy=ny*kick+(rvy-dot*ny)*.15;
 // Ellipse support point supplies an off-centre lever arm, not a new collider.
 const a=(h.appearanceAngle??h.angle??0)+(h.motionAngle??0),c=Math.cos(a),s=Math.sin(a);
 const lx=-nx*c-ny*s,ly=nx*s-ny*c,rx=h.size*.46,ry=h.size*.37;
 const den=Math.max(.001,Math.hypot(rx*lx,ry*ly));
 const ex=rx*rx*lx/den,ey=ry*ry*ly/den;
 const armX=c*ex-s*ey,armY=s*ex+c*ey;
 const jx=h.vx-vx,jy=h.vy-vy;
 const eccentric=(armX*jy-armY*jx)/Math.max(1,h.size*Math.hypot(jx,jy));
 const turn=clamp(eccentric*5,-.785,.785);
 h.angularVelocity=turn*4;h.contactBody=id;h.contactReleased=false;
 return true;
}

export type Petal={delay:number;life:number;dx:number;dy:number;radius:number;spin:number;angle:number;kind:number};
export type PetalGroup={active:boolean;age:number;x:number;y:number;vx:number;vy:number;count:number;color:number;size:number;items:Petal[]};
export type PetalSample={x:number;y:number;radius:number;angle:number;alpha:number;kind:number;color:number};
export class HeartPetalPool{
 readonly groups:PetalGroup[]=Array.from({length:12},()=>({active:false,age:0,x:0,y:0,vx:0,vy:0,count:0,color:0,size:0,
  items:Array.from({length:6},()=>({delay:0,life:0,dx:0,dy:0,radius:0,spin:0,angle:0,kind:0}))}));
 maxPerGroup=6;
 reset(){for(const g of this.groups)g.active=false;}
 step(dt:number){for(const g of this.groups)if(g.active){g.age+=dt;if(g.age>=.55)g.active=false;}}
 spawn(h:Heart){
  let g:PetalGroup|undefined;for(const candidate of this.groups)if(!candidate.active){g=candidate;break;}
  if(!g)return false;
  let seed=((h.birthOrder??0)+1)*2654435761>>>0;
  const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const p=heartCenter(h);g.active=true;g.age=Math.max(0,h.age-(HEART_LIFETIME-.15));g.x=p.x;g.y=p.y;
  g.vx=clamp(h.vx??0,-160,160)*.18;g.vy=clamp(h.vy??-20,-160,160)*.18;g.size=h.size;g.color=(h.colorOrder??0)%2;
  g.count=Math.min(this.maxPerGroup,3+Math.floor(rand()*4));
  const arcCount=1+Math.floor(rand()*2),direction=Math.atan2(g.vy,g.vx),offset=rand()*6.28;
  for(let i=0;i<g.count;i++){
   const p=g.items[i],a=offset+i*2.39996+(rand()-.5)*.8,spread=h.size*(.20+rand()*.20);
   p.delay=rand()*.05;p.life=.35+rand()*.15;p.dx=Math.cos(a)*spread+Math.cos(direction)*h.size*.05;
   p.dy=Math.sin(a)*spread*.8+Math.sin(direction)*h.size*.05;p.kind=i<arcCount?1:0;
   p.radius=p.kind?4+rand()*3:2.5+rand()*2.5;p.angle=rand()*6.28;p.spin=(rand()-.5)*3;
  }return true;
 }
 sample(g:PetalGroup,i:number,out:PetalSample){
  const p=g.items[i],t=(g.age-p.delay)/p.life,q=clamp(t,0,1),spread=1-(1-q)**2;
  out.x=g.x+g.vx*g.age+p.dx*spread;out.y=g.y+g.vy*g.age+p.dy*spread-5*q;
  out.radius=p.radius*(1-.3*q);out.angle=p.angle+p.spin*q;
  out.alpha=t<=0||t>=1?0:.95*smooth(q/.12)*(1-smooth((q-.5)/.5));out.kind=p.kind;out.color=g.color;return out;
 }
}
