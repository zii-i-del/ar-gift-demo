export type ContactVelocity = {vx:number;vy:number;squash?:number;squashAmount?:number;hitAngle?:number};
/** Common kinematic surface response, only while approaching. */
export function respondContact(b:ContactVelocity,nx:number,ny:number,cvx:number,cvy:number) {
 const vx=b.vx-cvx,vy=b.vy-cvy,dot=vx*nx+vy*ny;
 if(dot>=0)return false;
 b.vx=cvx+.95*(vx-dot*nx)-.4*dot*nx;
 b.vy=cvy+.95*(vy-dot*ny)-.4*dot*ny;
 const speed=Math.hypot(b.vx,b.vy);if(speed>420){b.vx*=420/speed;b.vy*=420/speed;}
 b.squash=.18;b.squashAmount=.08*Math.min(1,-dot/300);b.hitAngle=Math.atan2(ny,nx);
 return true;
}
