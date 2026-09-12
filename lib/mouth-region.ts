type Point = {x:number;y:number};
export type MouthState = 'covered'|'away'|'unknown';
/** Same six-point region for cover and release; never uses a gift support anchor. */
export function mouthRegion(raw:readonly number[]|undefined,map:(x:number,y:number)=>Point,mouth:Point,width:number){
  const unknown={state:'unknown' as MouthState,x:0,y:0};
  if(!raw||raw.length!==63||!Number.isFinite(width)||width<35)return unknown;
  let x=0,y=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,tipY=0,near=false;
  for(const n of [8,12,16,5,9,13]){
    const p=map(raw[n*3],raw[n*3+1]);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return unknown;
    x+=p.x/6;y+=p.y/6;minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    if(n===8||n===12||n===16){tipY+=p.y/3;near ||= Math.hypot(p.x-mouth.x,p.y-mouth.y)<width*.48;}
  }
  const wrist=map(raw[0],raw[1]);
  if(!Number.isFinite(wrist.x)||!Number.isFinite(wrist.y))return unknown;
  const covered=wrist.y-tipY>=width*.16&&Math.abs(x-mouth.x)<=width*.48&&Math.abs(y-mouth.y)<=width*.42&&near;
  // A failed orientation check alone is not release. Require spatial separation
  // of the observed finger/palm region from a padded mouth target.
  const separated=maxX<mouth.x-width*.22||minX>mouth.x+width*.22||maxY<mouth.y-width*.12||minY>mouth.y+width*.12;
  return {state:(separated?'away':covered?'covered':'unknown') as MouthState,x,y};
}
