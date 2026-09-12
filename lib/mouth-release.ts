import type {MouthState} from './mouth-region.ts';
type Evidence={last:number;count:number;elapsed:number;continuous:boolean};
/** Identity continuity is local to release, never tied to the previous trigger. */
export class MouthRelease {
  private observations=new Map<string,Evidence>();
  private lastSample=-Infinity;
  reason='waiting';
  states:{id:string;state:MouthState}[]=[];
  get elapsedMs(){let ms=0;for(const e of this.observations.values())ms=Math.max(ms,e.elapsed);return ms;}
  reset(){this.observations.clear();this.lastSample=-Infinity;this.states=[];this.reason='waiting';}
  observe(hands:readonly {id:string;state:MouthState}[],timestamp:number,covered:boolean){
    if(timestamp<=this.lastSample)return false;
    this.lastSample=timestamp;this.states=hands.map(h=>({...h}));
    if(covered){this.observations.clear();this.reason='covered';return false;}
    this.reason='unknown-paused';
    for(const [id,e] of this.observations){
      if(timestamp-e.last>200){this.observations.delete(id);this.reason='gap-or-identity-reset';}
      else if(!hands.some(h=>h.id===id&&h.state==='away'))e.continuous=false;
    }
    for(const hand of hands){
      if(hand.state==='covered'){this.observations.delete(hand.id);continue;}
      if(hand.state!=='away')continue;
      const old=this.observations.get(hand.id);
      const e:Evidence={last:timestamp,count:(old?.count??0)+1,elapsed:(old?.elapsed??0)+(old?.continuous?timestamp-old.last:0),continuous:true};
      this.observations.set(hand.id,e);this.reason='confirming-release';
      if(e.count>=2&&e.elapsed>=100){this.reason='released';return true;}
    }
    return false;
  }
}
