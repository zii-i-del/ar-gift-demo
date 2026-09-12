import {coverPoint} from './coordinates.ts';
export type HeadCollider = { x:number;y:number;rx:number;ry:number;angle:number };
const COUNT=64,TRAIL=8,ROCKET_TIME=.65;
export type FireParticle={x:number;y:number;vx:number;vy:number;age:number;life:number;active:boolean;color:string;size:number;trail:Float32Array;cursor:number;length:number};
export type Firework={particles:FireParticle[];age:number;origin:{x:number;y:number};target:{x:number;y:number};radius:number;burst:boolean};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function headCollider(face:number[]|null,w:number,h:number,sw=w,sh=h):HeadCollider|null{
 if(!face||face.length<468*3)return null;
 const p=(i:number)=>coverPoint(face[i*3],face[i*3+1],w,h,sw,sh),l=p(234),r=p(454),top=p(10),chin=p(152);
 return {x:(l.x+r.x)/2,y:(top.y+chin.y)/2,rx:Math.max(42,Math.abs(r.x-l.x)*.7),ry:Math.max(58,Math.abs(chin.y-top.y)*.58),angle:Math.atan2(r.y-l.y,r.x-l.x)};
}
export function spawnFirework(x:number,y:number,w=640,h=480,reuse?:Firework):Firework{
 const f=reuse??{particles:Array.from({length:COUNT},()=>({x:0,y:0,vx:0,vy:0,age:0,life:0,active:false,color:'#ff7098',size:2,trail:new Float32Array(TRAIL*2),cursor:0,length:0})),age:0,origin:{x:0,y:0},target:{x:0,y:0},radius:0,burst:false};
 // Reserve room for the entire bloom, including the stage labels above it.
 f.radius=Math.max(16,Math.min(w*.18,h*.19,110,Math.max(32,(y-60)*.72)));
 f.target.x=clamp(x,f.radius+12,w-f.radius-12);
 f.target.y=clamp(y,60+f.radius,h-f.radius-30);
 f.origin.x=f.target.x;f.origin.y=Math.min(h-16,f.target.y+Math.min(110,h*.22));
 f.age=0;f.burst=false;
 for(const p of f.particles){p.active=false;p.age=0;p.length=0;p.cursor=0;}
 const p=f.particles[0];p.active=true;p.x=f.origin.x;p.y=f.origin.y;p.life=ROCKET_TIME;p.color='#ffb63b';p.size=3;
 return f;
}
function remember(p:FireParticle){p.trail[p.cursor*2]=p.x;p.trail[p.cursor*2+1]=p.y;p.cursor=(p.cursor+1)%TRAIL;p.length=Math.min(TRAIL,p.length+1);}
export function stepFirework(f:Firework,dt:number,head:HeadCollider|null){
 // Background/resume gaps must not launch particles across the frame.
 if(!Number.isFinite(dt)||dt<=0||dt>.2)return f;
 dt=Math.min(dt,.05);f.age+=dt;
 if(!f.burst){
  const p=f.particles[0];remember(p);const t=Math.min(1,f.age/ROCKET_TIME);
  p.x=f.target.x;p.y=f.origin.y+(f.target.y-f.origin.y)*(1-(1-t)*(1-t));p.age=f.age;
  if(t<1)return f;
  f.burst=true;
  for(let i=0;i<COUNT;i++){
   const p=f.particles[i],outer=i<48,n=outer?48:16,j=outer?i:i-48,a=j/n*Math.PI*2+(outer?0:.12),speed=f.radius*(outer?1.75:.95);
   p.active=true;p.x=f.target.x;p.y=f.target.y;p.vx=Math.cos(a)*speed;p.vy=Math.sin(a)*speed;
   p.age=0;p.life=1.8+(i%5)*.13;p.size=outer?2.3:2.8;p.color=outer?'#f54a87':'#e99913';p.length=0;p.cursor=0;
  }
  return f;
 }
 const drag=Math.exp(-1.8*dt);
 for(const p of f.particles){if(!p.active)continue;remember(p);p.age+=dt;if(p.age>=p.life){p.active=false;continue;}
  p.vx*=drag;p.vy=p.vy*drag+42*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(head){const c=Math.cos(head.angle),s=Math.sin(head.angle),dx=p.x-head.x,dy=p.y-head.y,lx=dx*c+dy*s,ly=-dx*s+dy*c,q=Math.hypot(lx/head.rx,ly/head.ry);
   if(q>1e-4&&q<1){const gx=lx/(head.rx*head.rx),gy=ly/(head.ry*head.ry),len=Math.hypot(gx,gy),nx=(gx*c-gy*s)/len,ny=(gx*s+gy*c)/len,dot=p.vx*nx+p.vy*ny;
    if(dot<0){p.vx-=1.4*dot*nx;p.vy-=1.4*dot*ny;}
    p.x=head.x+(lx*c-ly*s)/q;p.y=head.y+(lx*s+ly*c)/q;
   }
  }
 }
 return f;
}
export const fireworkDone=(f:Firework)=>f.burst&&f.particles.every(p=>!p.active);
export function drawFirework(ctx:CanvasRenderingContext2D,f:Firework){
 ctx.save();ctx.lineCap='round';
 for(const p of f.particles){if(!p.active)continue;
  const fade=f.burst?Math.min(1,(p.life-p.age)/.7):Math.min(1,.3+f.age*5);
  ctx.globalAlpha=fade*.75;ctx.strokeStyle=p.color;ctx.lineWidth=f.burst?2.2:3;
  ctx.beginPath();ctx.moveTo(p.x,p.y);
  for(let j=0;j<p.length;j++){const i=(p.cursor-1-j+TRAIL)%TRAIL;ctx.lineTo(p.trail[i*2],p.trail[i*2+1]);}ctx.stroke();
  ctx.globalAlpha=fade;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size+1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff3c4';ctx.beginPath();ctx.arc(p.x,p.y,p.size*.45,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
