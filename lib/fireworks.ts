export type HeadCollider = { x: number; y: number; rx: number; ry: number; angle: number };
export type FireParticle = { x:number;y:number;px:number;py:number;vx:number;vy:number;age:number;life:number;phase:"rocket"|"burst";trail:Array<{x:number;y:number}>;hit:number };
export type Firework = { particles: FireParticle[]; age:number; origin:{x:number;y:number} };
export function headCollider(face:number[]|null,w:number,h:number):HeadCollider|null {
 if(!face||face.length<468*3)return null;
 const p=(i:number)=>({x:(1-face[i*3])*w,y:face[i*3+1]*h}); const l=p(234),r=p(454),top=p(10),chin=p(152);
 const cx=(l.x+r.x)/2, cy=(top.y+chin.y)/2; return {x:cx,y:cy,rx:Math.max(42,Math.abs(r.x-l.x)*.7),ry:Math.max(58,Math.abs(chin.y-top.y)*.58),angle:Math.atan2(r.y-l.y,r.x-l.x)};
}
export function spawnFirework(x:number,y:number):Firework { return {age:0,origin:{x,y},particles:[{x,y:y+80,px:x,py:y+80,vx:0,vy:-420,age:0,life:1.15,phase:"rocket",trail:[],hit:0}]}; }
export function stepFirework(f:Firework,dt:number,head:HeadCollider|null) {
 f.age+=dt; for(const p of f.particles){p.px=p.x;p.py=p.y;p.age+=dt;p.trail.unshift({x:p.x,y:p.y});if(p.trail.length>3)p.trail.pop();
  if(p.phase==="rocket"){p.vy+=150*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.age>.62||p.age>p.life||p.vy>=-35){p.phase="burst";p.age=0;p.life=.95;for(let i=0;i<32;i++){const a=i/32*Math.PI*2,s=130+(i%5)*20;f.particles.push({x:p.x,y:p.y,px:p.x,py:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,life:.9+(i%4)*.08,phase:"burst",trail:[],hit:0});}p.life=0;}}
  else {p.vy+=185*dt;p.vx*=Math.pow(.985,dt*60);p.x+=p.vx*dt;p.y+=p.vy*dt;if(head&&p.vy>0){const c=Math.cos(-head.angle),s=Math.sin(-head.angle),dx=p.x-head.x,dy=p.y-head.y,lx=dx*c-dy*s,ly=dx*s+dy*c,q=(lx*lx)/(head.rx*head.rx)+(ly*ly)/(head.ry*head.ry);if(q<1){const nx=lx/(head.rx*head.rx),ny=ly/(head.ry*head.ry),n=Math.hypot(nx,ny)||1;p.vx-=2*(p.vx*nx+p.vy*ny)/n*nx;p.vy-=2*(p.vx*nx+p.vy*ny)/n*ny;p.vy=-Math.abs(p.vy)*.55;p.vx*=.85;p.hit=.12;p.x=p.px;p.y=p.py;}}}
  if(p.hit>0)p.hit-=dt;
 } f.particles=f.particles.filter(p=>p.age<p.life||p.phase==="rocket"); return f;
}
export const fireworkDone=(f:Firework)=>f.particles.length===0||f.age>4;
