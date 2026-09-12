import {mouthRegion} from './mouth-region.ts';
import {MouthRelease} from './mouth-release.ts';
import {coversMouth, type Confetti} from './confetti.ts';
import type {Hand} from './interaction.ts';
/** Decisions consume distinct capture timestamps, never render-frame counts. */
export class GiftCoordinator {
  armed=true; candidate=-1; preparing=-1; lastSample=-Infinity; blocked=false; message='';
  reason='';
  private confirmedMs=0;
  private gapAt=-1;
  private gapUsed=false;
  private identity='';
  private coveredAt=-Infinity;
  private previousCovered=false;
  private release=new MouthRelease();
  private wasPlaying=false;
  get releaseDebug(){return {hands:this.release.states,elapsedMs:this.release.elapsedMs,reason:this.release.reason};}
  private cancel(reason:string){this.candidate=this.preparing=-1;this.confirmedMs=0;this.gapAt=-1;this.gapUsed=false;this.previousCovered=false;this.coveredAt=-Infinity;this.reason=reason;}
  reset(){this.cancel('reset');this.identity='';this.armed=true;this.candidate=this.preparing=-1;this.lastSample=-Infinity;this.blocked=this.wasPlaying=false;this.release.reset();this.message='';}
  phase(c:Confetti,now:number){return c.playing?(now-c.started>=6000?'finishing':'playing'):this.preparing>=0?'preparing':this.candidate>=0?'candidate':'idle';}
  sample(c:Confetti,hands:Hand[],timestamp:number,now:number,allowed=true){
    if(timestamp<=this.lastSample)return;
    const previousSample=this.lastSample;
    this.lastSample=timestamp;
    if(this.wasPlaying&&!c.playing)this.candidate=this.preparing=-1;
    this.wasPlaying=c.playing;
    const fresh=now-timestamp<=250 && now-c.faceTime<=250 && Math.abs(timestamp-c.faceTime)<=150 && !!c.face;
    const covered=fresh&&coversMouth(c.face,c.hands,c.map,c.mouthReference(now));
    this.blocked=!!covered;
    if(!fresh||!allowed){if(!allowed)this.release.reset();else this.release.observe([],timestamp,false);this.cancel(!fresh?'stale-face-or-hands':'performance-or-renderer');this.blocked=false;return;}
    if(!this.armed){
      const mouth=c.mouthReference(now),frame=c.frame(c.face);
      if(mouth&&frame){
        const observed=hands.map(h=>({id:h.id,state:mouthRegion(h.landmarks,c.map,mouth,frame.scale).state}));
        this.armed=this.release.observe(observed,timestamp,covered);
      }else this.release.observe([],timestamp,false);
      this.message=this.armed?'':'任意一只手离开嘴部片刻，即可准备下一轮';
      return;
    }
    if(c.playing){this.candidate=this.preparing=-1;return;}
    const identity=hands.map(h=>h.id).sort().join('|');
    if(hands.length!==2||c.hands.length!==2){this.cancel('tracking-interrupted');this.identity='';return;}
    if(identity!==this.identity||timestamp-previousSample>200){this.cancel('identity-or-tracking-gap');this.identity=identity;}
    if(!covered){
      const mouth=c.mouthReference(now),frame=c.frame(c.face);
      const away=!!mouth&&!!frame&&c.hands.some(raw=>mouthRegion(raw,c.map,mouth,frame.scale).state==='away');
      if(away||this.candidate<0||this.gapUsed){this.cancel(away?'explicit-release':'ambiguous-reset');this.message='';return;}
      this.gapUsed=true;this.gapAt=timestamp;this.previousCovered=false;this.reason='ambiguous-paused';return;
    }
    if(this.gapAt>=0&&timestamp-this.gapAt>150)this.cancel('ambiguity-expired');
    if(this.candidate<0){this.candidate=timestamp;this.confirmedMs=0;}
    else if(this.previousCovered)this.confirmedMs+=timestamp-previousSample;
    this.gapAt=-1;this.previousCovered=true;this.coveredAt=timestamp;this.reason='confirming';
    if(this.confirmedMs<300)return;
    if(this.preparing<0)this.preparing=timestamp;
    this.surfaceReady(c,now,allowed);
  }
  surfaceReady(c:Confetti,now:number,allowed=true){
    if(this.preparing<0||c.playing||!this.armed)return;
    if(now-this.preparing>800){this.cancel('surface-timeout');this.message='头发识别未在预算时间内就绪，请保持有效手势重新确认';return;}
    if(!allowed||!c.face||!this.previousCovered||this.gapAt>=0||now-this.coveredAt>250||now-c.faceTime>250||Math.abs(this.coveredAt-c.faceTime)>150)return;
    const surface=c.surfaces.get('hair'),interior=c.surfaces.get('frontHair');
    const prepared=c.hairPreparation==='no-interior'||(c.hairPreparation==='interior'&&interior?.valid&&!!interior.segments.length&&now-interior.timestamp<=250&&now-interior.poseTime<=250);
    if(c.modelReady&&prepared&&surface?.valid&&surface.segments.length&&now-surface.timestamp<=250&&now-surface.poseTime<=250&&c.trigger(now)){
      this.armed=false;this.candidate=this.preparing=-1;this.release.reset();this.message='';
    }else {this.reason='surface-pending';this.message='正在准备头发接触表面…';}
  }
  expire(now:number){if(now-this.lastSample>250){this.cancel('hands-expired');this.blocked=false;}else if(this.gapAt>=0&&now-this.gapAt>150)this.cancel('ambiguity-expired');else if(this.preparing>=0&&now-this.preparing>800){this.cancel('surface-timeout');this.message='头发识别未在预算时间内就绪，请保持有效手势重新确认';}}
  status(c:Confetti){return c.playing?'播放中':!this.armed?'等待松手':this.preparing>=0?'准备头发':this.candidate>=0?'正在确认捂嘴':'可触发';}
  filter(hands:Hand[],blocked:boolean){return hands.map(h=>({...h,heart:!blocked&&h.heart&&!h.gun,heartPossible:false,gun:!blocked&&!!h.gun&&!h.heart&&!h.heartPossible}));}
}
