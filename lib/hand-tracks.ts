type Point={x:number;y:number};
export type HandTrack={id:string;label:string;wrist:Point;seen:number};
// The detector returns at most two hands. Prefer two valid associations, then
// the lowest total cost, without relaxing the distance or freshness gates.
export function matchHandTracks(candidates:{hand:{wrist:Point;span:number};label:string}[],tracks:HandTrack[],now:number){
 const pairs:{candidate:number;track:number;cost:number}[]=[];
 for(let i=0;i<candidates.length;i++)for(let j=0;j<tracks.length;j++){
  const c=candidates[i],t=tracks[j];if(now-t.seen>200)continue;
  const gate=Math.max(80,c.hand.span*2),distance=Math.hypot(c.hand.wrist.x-t.wrist.x,c.hand.wrist.y-t.wrist.y);
  if(distance<gate)pairs.push({candidate:i,track:j,cost:distance/gate+(c.label===t.label?0:.12)});
 }
 // Geometry and stable IDs break ties independently of detector/track order.
 pairs.sort((a,b)=>a.cost-b.cost
  || candidates[a.candidate].hand.wrist.x-candidates[b.candidate].hand.wrist.x
  || candidates[a.candidate].hand.wrist.y-candidates[b.candidate].hand.wrist.y
  || candidates[a.candidate].label.localeCompare(candidates[b.candidate].label)
  || tracks[a.track].id.localeCompare(tracks[b.track].id));
 const matches:(string|undefined)[]=Array(candidates.length).fill(undefined);
 let first=pairs[0],second:typeof first|undefined,bestCost=Infinity;
 for(let a=0;a<pairs.length;a++)for(let b=a+1;b<pairs.length;b++){
  const p=pairs[a],q=pairs[b];
  if(p.candidate===q.candidate||p.track===q.track)continue;
  const cost=p.cost+q.cost;
  if(cost<bestCost){first=p;second=q;bestCost=cost;}
 }
 if(first)matches[first.candidate]=tracks[first.track].id;
 if(second)matches[second.candidate]=tracks[second.track].id;
 return matches;
}
