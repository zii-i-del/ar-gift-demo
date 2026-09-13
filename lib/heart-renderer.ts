import { orderHearts, heartDepthLayout } from './heart-presentation.ts';
import { animatedHeartRadius } from './heart-bounds.ts';
import { HEART_CAPACITY, HEART_LIFETIME } from './heart-flow.ts';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Heart } from './interaction';
import {heartClipTime} from './heart-animation';
import {heartFinish,heartSquash,HEART_SETTLE} from './heart-response.ts';
import type {HeartPetalPool,PetalSample} from './heart-lightweight.ts';

export class HeartRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);
  ready = false;
  disposed = false;
  slots: { root: THREE.Group; axis:THREE.Group; unrotate:THREE.Group; mixer: THREE.AnimationMixer; materials: THREE.MeshPhysicalMaterial[]; peach: THREE.MeshPhysicalMaterial[]; meshes: THREE.Mesh[] }[] = [];
  private bodyCenter=new THREE.Vector3();
  private centerOffset=new THREE.Vector3();
  private turnOffset=new THREE.Vector3();
  private petalSample:PetalSample={x:0,y:0,radius:0,angle:0,alpha:0,kind:0,color:0};
  private moteKind=new THREE.InstancedBufferAttribute(new Float32Array(HEART_CAPACITY*8),1);
  private pinkMote=new THREE.Color(0xffaac5);
  private yellowMote=new THREE.Color(0xffdf8c);
  private motePose=new THREE.Object3D();
  private motes:THREE.InstancedMesh;
  private moteAlpha=new THREE.InstancedBufferAttribute(new Float32Array(HEART_CAPACITY*8),1);
  private modelRadius=1;
  private ordered:number[]=[];
  private ranks=new Int16Array(HEART_CAPACITY);
  private renderSize=new THREE.Vector2();
  private environment: THREE.WebGLRenderTarget;
  private assetTextures=new Set<THREE.Texture>();
  constructor(private shared?:THREE.WebGLRenderer) {
    this.renderer = shared ?? new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    // One broad asymmetric softbox, rather than a room of sharp rectangles.
    const studio=new THREE.Scene();studio.background=new THREE.Color(.48,.39,.42);
    const softbox=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({color:new THREE.Color(4,4,4),side:THREE.DoubleSide}));
    softbox.position.set(-3,4,5);softbox.scale.set(2,3,1);softbox.lookAt(0,0,0);studio.add(softbox);
    const pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environment=pmrem.fromScene(studio,.04); this.scene.environment=this.environment.texture;
    this.scene.environmentIntensity=.8;
    softbox.geometry.dispose();softbox.material.dispose();pmrem.dispose();
    this.camera.position.z=1000;
    this.scene.add(new THREE.HemisphereLight(0xfff2f5,0xcc477c,1));
    const key=new THREE.DirectionalLight(0xfff5f2,2);key.position.copy(softbox.position);this.scene.add(key);
    const moteGeometry=new THREE.PlaneGeometry(2,2);moteGeometry.setAttribute('moteAlpha',this.moteAlpha);
    moteGeometry.setAttribute('moteKind',this.moteKind);
    const moteMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:`attribute float moteAlpha; attribute float moteKind; varying float kind; varying float opacity; varying vec2 pointUv; varying vec3 tint;
        void main(){kind=moteKind;opacity=moteAlpha;pointUv=uv;tint=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`varying float kind; varying float opacity; varying vec2 pointUv; varying vec3 tint;
        void main(){vec2 p=pointUv*2.-1.;float r=length(p);float a=1.-smoothstep(.05,1.,r);
        if(kind>.5){float outer=1.-smoothstep(.72,.94,r);float inner=smoothstep(.57,.73,length(p-vec2(.28,.10)));a=outer*inner;}
        a*=opacity;
        gl_FragColor=vec4(tint,a); #include <colorspace_fragment> }`.replace('#include <colorspace_fragment>','\n#include <colorspace_fragment>\n')});
    this.motes=new THREE.InstancedMesh(moteGeometry,moteMaterial,HEART_CAPACITY*8);
    this.motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.moteAlpha.setUsage(THREE.DynamicDrawUsage);
    const initialMoteColor=new THREE.Color(0xffb6cd);
    for(let i=0;i<HEART_CAPACITY*8;i++)this.motes.setColorAt(i,initialMoteColor);
    this.motes.count=0;this.motes.frustumCulled=false;this.motes.renderOrder=2;this.scene.add(this.motes);
  }
  async load() {
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    const retain=(scene:THREE.Object3D)=>scene.traverse(o=>{
      if(o instanceof THREE.Mesh){
        geometries.add(o.geometry);
        for(const m of Array.isArray(o.material)?o.material:[o.material]){
          materials.add(m);
          for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);
        }
      }
    });
    try {
    const gltf=await new GLTFLoader().loadAsync('/assets/heart-crystal-v21-pink.glb');
    retain(gltf.scene);
    if(this.disposed)return;
    const clip=gltf.animations.find(a=>a.name==='Heart_Grow') || gltf.animations[0];
    if(!clip) throw new Error('Heart_Grow animation missing');
    this.modelRadius=animatedHeartRadius(gltf.scene,clip);
    const inspect=new THREE.AnimationMixer(gltf.scene);inspect.clipAction(clip).play();inspect.setTime(.82);gltf.scene.updateMatrixWorld(true);
    const body=gltf.scene.getObjectByName('Heart_Glass');
    if(body)new THREE.Box3().setFromObject(body).getCenter(this.bodyCenter);
    inspect.stopAllAction();inspect.uncacheRoot(gltf.scene);
    const peach=await new GLTFLoader().loadAsync('/assets/heart-crystal-v21-yellow.glb');
    retain(peach.scene);
    if(this.disposed)return;
    const peachBody=peach.scene.getObjectByName('Heart_Glass') as THREE.Mesh;
    const peachSource=peachBody.material as THREE.MeshPhysicalMaterial;
    for(let i=0;i<HEART_CAPACITY;i++) {
      const root=new THREE.Group(); const model=gltf.scene.clone(true); const materials:THREE.MeshPhysicalMaterial[]=[];const peach:THREE.MeshPhysicalMaterial[]=[];const meshes:THREE.Mesh[]=[];
      model.traverse(o=>{if(o instanceof THREE.Mesh){
        const m=(o.material as THREE.MeshPhysicalMaterial).clone();
        this.restoreEstablishedMaterial(m);
        o.visible=o.name==='Heart_Glass';
        o.material=m; o.renderOrder=1; materials.push(m);meshes.push(o);
        const accent=peachSource.clone();peach.push(accent);
        this.restoreEstablishedMaterial(accent);
      }});
      const axis=new THREE.Group(),unrotate=new THREE.Group();axis.position.copy(this.bodyCenter);model.position.sub(this.bodyCenter);
      unrotate.add(model);axis.add(unrotate);root.add(axis); root.visible=false; this.scene.add(root);
      const mixer=new THREE.AnimationMixer(model); const action=mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true; action.play();
      this.slots.push({root,axis,unrotate,mixer,materials,peach,meshes});
    }

    this.ready=true;
    } finally {
      // Clones share geometry/textures, but own their cloned materials.
      const used=new Set<THREE.BufferGeometry>();
      for(const slot of this.slots)for(const mesh of slot.meshes)used.add(mesh.geometry);
      for(const geometry of geometries)if(!used.has(geometry))geometry.dispose();
      for(const material of materials)material.dispose();
      for(const texture of textures){if(this.ready)this.assetTextures.add(texture);else texture.dispose();}
    }
  }
  private restoreEstablishedMaterial(material:THREE.MeshPhysicalMaterial){
    // Shared finish; color and textures remain those of each source material.
    material.transparent=false;
    material.depthWrite=true;
    material.side=THREE.FrontSide;
    material.transmission=0;
    material.thickness=0;
    material.userData.baseOpacity=1;
    material.roughness=.13;
    material.clearcoat=.65;
    material.clearcoatRoughness=.13;
  }
  draw(hearts:Heart[],width:number,height:number,previewAngle?:number,lifetime=HEART_LIFETIME,petals?:HeartPetalPool|null) {
    if(!this.ready || width<1 || height<1)return;
    const size=this.renderSize;this.renderer.getSize(size);
    if(size.x!==width||size.y!==height)this.renderer.setSize(width,height);
    orderHearts(hearts,this.ordered,lifetime);
    let maxSize=0;for(let rank=0;rank<this.ordered.length;rank++){const i=this.ordered[rank];this.ranks[i]=rank;maxSize=Math.max(maxSize,hearts[i].size);}
    const depth=heartDepthLayout(this.modelRadius*maxSize/2,this.ordered.length);
    this.camera.position.z=depth.cameraZ;
    if(this.camera.right!==width/2||this.camera.top!==height/2||this.camera.far!==depth.far){
      this.camera.far=depth.far;
      this.camera.left=-width/2;this.camera.right=width/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();
    }
    let moteCount=0;
    for(let i=0;i<HEART_CAPACITY;i++) {
      const slot=this.slots[i],h=hearts[i];slot.root.visible=!!h?.active && h.age<lifetime;
      if(!slot.root.visible)continue;
      const angle=h.angle ?? 0;
      // Heart_Rig is a bottom pivot; 8px clearance follows the emitter direction.
      slot.root.position.set(h.x+Math.sin(angle)*8-width/2,height/2-h.y+Math.cos(angle)*8,this.ranks[i]*depth.spacing);
      const finish=heartFinish(h.age,lifetime),baseScale=h.size/2;
      slot.root.scale.setScalar(baseScale*finish);
      slot.root.rotation.z=-(h.appearanceAngle ?? h.angle ?? 0);
      slot.root.rotation.y=previewAngle ?? Math.sin(h.age*2)*.12;
      // Freeze the old baked fade/shrink; contract about the body's centre instead.
      slot.mixer.setTime(heartClipTime(Math.min(h.age,lifetime-HEART_SETTLE),lifetime));
      this.centerOffset.copy(this.bodyCenter).applyEuler(slot.root.rotation).multiplyScalar(baseScale);
      slot.root.position.addScaledVector(this.centerOffset,1-finish);
      slot.root.rotation.z-=h.motionAngle??0;
      this.turnOffset.copy(this.bodyCenter).applyEuler(slot.root.rotation).multiplyScalar(baseScale*finish);
      slot.root.position.addScaledVector(this.centerOffset,finish).sub(this.turnOffset);
      const end=Math.max(0,Math.min(1,(h.age-(lifetime-.30))/.24));
      const release=Math.sin(end*Math.PI)*.06;slot.root.scale.x*=1-release;slot.root.scale.y*=1+release;
      // Compensate even the small final directional squeeze about the centre.
      this.turnOffset.copy(this.bodyCenter).multiply(slot.root.scale).applyEuler(slot.root.rotation);
      slot.root.position.set(h.x+Math.sin(angle)*8-width/2+this.centerOffset.x-this.turnOffset.x,
        height/2-h.y+Math.cos(angle)*8+this.centerOffset.y-this.turnOffset.y,this.ranks[i]*depth.spacing);
      const squeeze=heartSquash(h),axis=-(h.hitAngle??0)-slot.root.rotation.z;
      slot.axis.rotation.z=axis;slot.unrotate.rotation.z=-axis;
      slot.axis.scale.set(1-squeeze,1+squeeze*.65,1+squeeze*.25);
      // Alternating warm accent. Stable for the entire lifetime,
      // independent of recycled slot, hand owner, frame rate, or animation age.
      const accent=h.colorOrder!==undefined && h.colorOrder%2===1;
      const activeMaterials=accent?slot.peach:slot.materials;
      slot.meshes.forEach((mesh,j)=>{mesh.material=activeMaterials[j];});
      activeMaterials.forEach(m=>{
        if(m.transparent){m.transparent=false;m.depthWrite=true;m.needsUpdate=true;}
        m.opacity=m.userData.baseOpacity;
      });
    }
    if(petals)for(const g of petals.groups){
      if(!g.active)continue;
      for(let j=0;j<g.count&&moteCount<72;j++){
        const p=petals.sample(g,j,this.petalSample);if(p.alpha<=0)continue;
        this.motePose.position.set(p.x-width/2,height/2-p.y,0);this.motePose.rotation.z=-p.angle;
        this.motePose.scale.set(p.radius,p.radius,1);this.motePose.updateMatrix();
        this.motes.setMatrixAt(moteCount,this.motePose.matrix);this.motes.setColorAt(moteCount,p.color?this.yellowMote:this.pinkMote);
        this.moteAlpha.setX(moteCount,p.alpha);this.moteKind.setX(moteCount,p.kind);moteCount++;
      }
    }
    this.motes.count=moteCount;this.motes.instanceMatrix.needsUpdate=true;this.moteAlpha.needsUpdate=true;
    this.moteKind.needsUpdate=true;
    if(this.motes.instanceColor)this.motes.instanceColor.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.ready=false;
    this.motes.geometry.dispose();(this.motes.material as THREE.Material).dispose();
    const geometries=new Set<THREE.BufferGeometry>();
    for(const s of this.slots){s.mixer.stopAllAction();s.mixer.uncacheRoot(s.mixer.getRoot());s.materials.forEach(m=>m.dispose());s.peach.forEach(m=>m.dispose());s.root.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});}
    geometries.forEach(g=>g.dispose());this.assetTextures.forEach(t=>t.dispose());this.assetTextures.clear();this.environment.dispose();if(!this.shared)this.renderer.dispose();this.slots=[];
  }
}
