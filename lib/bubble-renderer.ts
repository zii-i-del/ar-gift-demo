import {cameraScale} from "./coordinates";
import {BUBBLE_CAPACITY,orderBubbles} from './bubble-stream.ts';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {makeOpticalMaterial,setBubbleUniforms,makeRuptureGeometry,makeRuptureController} from './bubble-optics.js';
import type {Bubble} from './interaction';

// One video texture / background target for the entire pool; output contains only bubble pixels.
export class BubbleRenderer {
  renderer:THREE.WebGLRenderer;
  private videoTime=-1;
  private targetWidth=0;
  private targetHeight=0;
  ready=false;
  private order:number[]=[];
  private disposed=false;
  private scene=new THREE.Scene();
  private back=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);
  private plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({toneMapped:false}));
  private target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
  private videoTexture?:THREE.VideoTexture;
  private geometry?:THREE.BufferGeometry;
  private maps:THREE.Texture[]=[];
  private size=new THREE.Vector2();
  private ruptureGeometry=makeRuptureGeometry();
  private slots:{mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;rupture:ReturnType<typeof makeRuptureController>}[]=[];
  constructor(private shared?:THREE.WebGLRenderer, private sharedVideo?:THREE.VideoTexture){
    this.renderer=shared ?? new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.setClearColor(0,0);this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.camera.position.z=1000;this.back.add(this.plane);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x978ab5,2));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-2,3,4);this.scene.add(light);
  }
  async load(){
    const loader=new THREE.TextureLoader(),base='/assets/bubble-optical/';
    // Sequential ownership assignment makes partial failure and unmount cleanup safe.
    for(const name of ['studio-environment.png','film-matcap.png','highlight-matcap.png']){
      const t=await loader.loadAsync(base+name);if(this.disposed){t.dispose();return;}this.maps.push(t);
    }
    const [env,film,highlight]=this.maps;
    env.colorSpace=THREE.SRGBColorSpace;env.mapping=THREE.EquirectangularReflectionMapping;
    film.colorSpace=highlight.colorSpace=THREE.SRGBColorSpace;
    film.generateMipmaps=highlight.generateMipmaps=true;
    const gltf=await new GLTFLoader().loadAsync(base+'bubble.glb');
    const shell=gltf.scene.getObjectByName('Bubble_Shell') as THREE.Mesh;
    gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());if(this.disposed||o!==shell)o.geometry.dispose();}});
    if(this.disposed)return;
    this.geometry=shell.geometry;
    for(let i=0;i<BUBBLE_CAPACITY;i++){
      const mesh=new THREE.Mesh(this.geometry,makeOpticalMaterial({background:this.target.texture,environment:env,film,highlight}));mesh.updateMorphTargets();
      const rupture=makeRuptureController(this.ruptureGeometry,env);this.scene.add(mesh,rupture.root);this.slots.push({mesh,rupture});
    }
    this.ready=true;
  }
  draw(bubbles:Bubble[],width:number,height:number,video:HTMLVideoElement){
    if(!this.ready||width<1||height<1||video.readyState<2||!bubbles.some(b=>b.active))return false;
    this.renderer.getSize(this.size);const dpr=this.renderer.getPixelRatio();
    if(this.size.x!==width||this.size.y!==height)this.renderer.setSize(width,height);
    const k=Math.min(dpr,1280/width,720/height),tw=Math.max(1,Math.round(width*k)),th=Math.max(1,Math.round(height*k));
    if(this.targetWidth!==tw||this.targetHeight!==th){this.target.setSize(tw,th);this.targetWidth=tw;this.targetHeight=th;this.videoTime=-1;}
    if(!this.videoTexture||this.videoTexture.image!==video){if(!this.sharedVideo)this.videoTexture?.dispose();this.videoTexture=this.sharedVideo ?? new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.SRGBColorSpace;this.plane.material.map=this.videoTexture;this.plane.material.needsUpdate=true;}
    const cover=cameraScale(width,height,video.videoWidth,video.videoHeight),rx=width>=height?1:width/(video.videoWidth*cover),ry=width>=height?1:height/(video.videoHeight*cover);
    this.videoTexture.repeat.set(-rx,ry);this.videoTexture.offset.set((1+rx)/2,(1-ry)/2);
    this.camera.left=-width/2;this.camera.right=width/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();this.plane.scale.set(width>=height?video.videoWidth*cover:width,width>=height?video.videoHeight*cover:height,1);
    if(this.videoTime!==video.currentTime){this.renderer.setRenderTarget(this.target);this.renderer.clear();this.renderer.render(this.back,this.camera);this.renderer.setRenderTarget(null);this.videoTime=video.currentTime;}
    for(const slot of this.slots){slot.mesh.visible=false;slot.rupture.root.visible=false;}
    orderBubbles(bubbles,this.order);
    for(let rank=0;rank<this.order.length;rank++){
      const i=this.order[rank],slot=this.slots[i],b=bubbles[i];slot.mesh.visible=b.pop<.06;
      slot.mesh.position.set(b.x-width/2,height/2-b.y,rank*.1);slot.mesh.rotation.z=-(b.hitAngle??0);slot.mesh.renderOrder=rank;slot.rupture.root.renderOrder=rank;for(const drop of slot.rupture.root.children)drop.renderOrder=rank;
      const growth=b.targetR ? Math.sin(Math.PI*Math.min(1,b.age/.45))*.05 : 0;
      slot.mesh.scale.set(b.r*(1-growth),b.r*(1+growth),b.r);
      slot.mesh.morphTargetInfluences![0]=Math.min(1,Math.max(0,(b.squashAmount??0)/.08))*Math.sin(Math.PI*Math.min(1,Math.max(0,(b.squash??0)/.18)));
      setBubbleUniforms(slot.mesh.material,b,width,height,dpr,b.birthOrder??i);
      slot.rupture.root.position.copy(slot.mesh.position);slot.rupture.root.rotation.copy(slot.mesh.rotation);slot.rupture.root.scale.setScalar(b.r);slot.rupture.update(b.pop);
    }
    this.renderer.render(this.scene,this.camera);return true;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.ready=false;this.slots.forEach(s=>{s.mesh.material.dispose();s.rupture.dispose();});this.slots=[];this.geometry?.dispose();this.ruptureGeometry.drop.dispose();this.maps.forEach(t=>t.dispose());this.maps=[];if(!this.sharedVideo)this.videoTexture?.dispose();this.plane.geometry.dispose();this.plane.material.dispose();this.target.dispose();if(!this.shared)this.renderer.dispose();}
}
