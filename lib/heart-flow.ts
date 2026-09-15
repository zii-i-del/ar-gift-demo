type P={x:number;y:number};
export const HEART_CAPACITY=12,HEART_LIFETIME=1.9;
// Seven births avoids locking any size to the five-birth color cadence.
// Smaller companion hearts create size contrast within the maximum size limit.
const HEART_SIZE_WEIGHTS=[.72,.96,.84,1.10,.92,1,.80];
export function heartBirthSize(width:number,height:number,sequence:number){
 return Math.min(144,Math.min(width,height)*.24)*.55*(width>height?1.01616768:1.1025)*HEART_SIZE_WEIGHTS[sequence%HEART_SIZE_WEIGHTS.length];
}
// Closest pair of finite segments, including endpoint and degenerate cases.
export function fingerEmitter(a:P,b:P,c:P,d:P,palm:P,indexJoint:P=c) {
 const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,wx=a.x-c.x,wy=a.y-c.y;
 const A=ux*ux+uy*uy,B=ux*vx+uy*vy,C=vx*vx+vy*vy,D=ux*wx+uy*wy,E=vx*wx+vy*wy;
 const clamp=(v:number)=>Math.max(0,Math.min(1,v));
 const denom=A*C-B*B;
 let s=denom>1e-6?clamp((B*E-C*D)/denom):0,t=C>1e-6?(B*s+E)/C:0;
 if(t<0){t=0;s=A>1e-6?clamp(-D/A):0;}else if(t>1){t=1;s=A>1e-6?clamp((B-D)/A):0;}
 const origin={x:(a.x+s*ux+c.x+t*vx)/2,y:(a.y+s*uy+c.y+t*vy)/2};
 const idx=d.x-indexJoint.x,idy=d.y-indexJoint.y;
 const un=Math.hypot(ux,uy),vn=Math.hypot(idx,idy);
 // Prefer the thumb axis; normalize each finger so apparent length does not set its weight.
 let dx=.7*ux/Math.max(1,un)+.3*idx/Math.max(1,vn),dy=.7*uy/Math.max(1,un)+.3*idy/Math.max(1,vn);
 if(Math.hypot(dx,dy)<.2){dx=origin.x-palm.x;dy=origin.y-palm.y;}
 const n=Math.hypot(dx,dy);
 return {origin,direction:n>1e-3?{x:dx/n,y:dy/n}:null,
   thumbBeyond:(1-s)*Math.sqrt(A),indexBeyond:(1-t)*Math.sqrt(C),
   thumbLength:Math.sqrt(A),indexLength:Math.sqrt(C)};
}

const HEART_OFFSETS = [-10, 10, -5, 5, 0];
// Only sampled at successful birth; no extra per-frame motion work.
export function heartBirthOffset(sequence:number, jitter:number=Math.random()) {
  return (HEART_OFFSETS[sequence % HEART_OFFSETS.length]+(jitter*4-2))*Math.PI/180;
}
