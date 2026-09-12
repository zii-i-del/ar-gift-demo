type Point={x:number;y:number};
export type HandTrack={id:string;label:string;wrist:Point;seen:number};
// Spatial continuity first, label only breaks close scores. Match pairs globally so
// a result-array reorder cannot let the first hand steal the other hand's track.
export function matchHandTracks(candidates:{hand:{wrist:Point;span:number};label:string}[],tracks:HandTrack[],now:number){
 const pairs:{candidate:number;track:number;cost:number}[]=[];
 for(let i=0;i<candidates.length;i++)for(let j=0;j<tracks.length;j++){
  const c=candidates[i],t=tracks[j];if(now-t.seen>200)continue;
  const gate=Math.max(80,c.hand.span*2),distance=Math.hypot(c.hand.wrist.x-t.wrist.x,c.hand.wrist.y-t.wrist.y);
  if(distance<gate)pairs.push({candidate:i,track:j,cost:distance/gate+(c.label===t.label?0:.12)});
 }
 pairs.sort((a,b)=>a.cost-b.cost||a.track-b.track);
 const matches:(string|undefined)[]=Array(candidates.length).fill(undefined),used=new Set<number>();
 for(const p of pairs)if(matches[p.candidate]===undefined&&!used.has(p.track)){matches[p.candidate]=tracks[p.track].id;used.add(p.track);}
 return matches;
}
