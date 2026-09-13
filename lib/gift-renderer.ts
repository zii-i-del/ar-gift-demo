import * as THREE from 'three';
import {ConfettiRenderer} from './confetti-renderer';
import {HeartRenderer} from './heart-renderer';
import {BubbleRenderer} from './bubble-renderer';
import type {Confetti} from './confetti';
import type {Interaction} from './interaction';

/** One context. The DOM video is the sole visible background. */
export class GiftRenderer {
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  videoTexture:THREE.VideoTexture;
  confetti:ConfettiRenderer;
  hearts:HeartRenderer;
  bubbles:BubbleRenderer;
  disposed=false;
  private needsClear=true;
  ready={confetti:true,hearts:false,bubble:false};
  errors:Record<string,string>={};
  constructor(video:HTMLVideoElement){
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.SRGBColorSpace;
    this.confetti=new ConfettiRenderer(this.renderer);
    this.hearts=new HeartRenderer(this.renderer);
    this.bubbles=new BubbleRenderer(this.renderer,this.videoTexture);
    this.renderer.autoClear=false;this.renderer.setClearColor(0,0);
  }
  async load(){
    for(const [key,view] of [['hearts',this.hearts],['bubble',this.bubbles]] as const){
      if(this.disposed)return;
      try{await view.load();if(!this.disposed)this.ready[key]=true;}catch{if(!this.disposed){view.dispose();this.errors[key]='素材加载失败';}}
    }
  }
  draw(c:Confetti,i:Interaction,video:HTMLVideoElement){
    const r=this.renderer,dpr=Math.min(devicePixelRatio,1.5);
    if(r.getPixelRatio()!==dpr){r.setPixelRatio(dpr);this.needsClear=true;}
    if(r.domElement.width!==Math.floor(c.width*dpr)||r.domElement.height!==Math.floor(c.height*dpr)){r.setSize(c.width,c.height);this.needsClear=true;}
    const stars=c.active>0;
    const hearts=this.ready.hearts&&(i.hearts.some(h=>h.active)||!!i.heartPetals?.groups.some(g=>g.active));
    const bubbles=this.ready.bubble&&i.bubbles.some(b=>b.active);
    const active=stars||hearts||bubbles;
    if(!active&&!this.needsClear)return;
    r.setRenderTarget(null);r.clear();this.needsClear=active;
    if(stars){r.toneMapping=THREE.NoToneMapping;this.confetti.draw(c);}
    if(hearts){
      r.clearDepth();r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1;
      this.hearts.draw(i.hearts,c.width,c.height,undefined,undefined,i.heartPetals);
    }
    if(bubbles){r.clearDepth();r.toneMapping=THREE.NoToneMapping;this.bubbles.draw(i.bubbles,c.width,c.height,video);}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.confetti.dispose();this.hearts.dispose();this.bubbles.dispose();this.videoTexture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();}
}
