export type EmitterKind = 'hearts' | 'bubble' | '';
export type EmitterCandidate = {id:string; kind:EmitterKind; confirmed:boolean};
/** Bounded to the two tracked hands. Selection never changes the emission clocks. */
export class PrimaryEmitter {
  id=''; kind:EmitterKind=''; reason='idle';
  private samples:EmitterCandidate[]=[];
  private timestamp=-Infinity;
  private ownerSeen=-Infinity;
  reset(){this.id='';this.kind='';this.reason='idle';this.samples=[];this.timestamp=this.ownerSeen=-Infinity;}
  update(samples:EmitterCandidate[],timestamp:number){
    if(timestamp<=this.timestamp)return;
    if(this.id&&timestamp-this.ownerSeen>200){this.id='';this.kind='';}
    this.samples=samples;this.timestamp=timestamp;
    const owner=samples.find(s=>s.id===this.id);
    if(owner){this.ownerSeen=timestamp;if(!owner.kind){this.id='';this.kind='';}else this.kind=owner.kind;}
    this.select(timestamp);
  }
  select(now:number):EmitterCandidate|undefined{
    if(this.id&&now-this.ownerSeen>200){this.id='';this.kind='';}
    if(now-this.timestamp>200){this.reason='stale';return;}
    if(!this.id){
      let next:EmitterCandidate|undefined;
      for(const s of this.samples)if(s.kind&&s.confirmed&&(!next||s.id<next.id))next=s;
      if(next){this.id=next.id;this.kind=next.kind;this.ownerSeen=this.timestamp;}
    }
    const owner=this.samples.find(s=>s.id===this.id);
    this.reason=!this.id?'idle':!owner?'tracking-gap':!owner.confirmed?'confirming':'emitting';
    return owner?.confirmed&&owner.kind?owner:undefined;
  }
}
