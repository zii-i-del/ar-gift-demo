import * as THREE from 'three';
import { STAR_POINTS } from './confetti-star';
function starGeometry() {
  const geometry = new THREE.BufferGeometry(),
    positions = [0, 0, 0],
    uvs = [0.5, 0.5],
    indices = [];
  for (const [x, y] of STAR_POINTS) {
    positions.push(x, y, 0);
    uvs.push(x + 0.5, y + 0.5);
  }
  for (let i = 0; i < 10; i++) indices.push(0, i + 1, ((i + 1) % 10) + 1);
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
import { Confetti, world } from './confetti';
// Small shared sRGB color ramp, created once; no per-particle images.
function prismRamp() {
  const palettes = [
    [0xf295dd, 0x91cfff, 0xa8f0df, 0xffedac, 0xd799ee],
    [0xb2a3f3, 0xf7aecb, 0xffe3a1, 0x95e8d5, 0x94bcf2],
    [0x7ccee8, 0xbda8ed, 0xffa7cf, 0xffe7b4, 0xa4edda],
    [0xe4a0f0, 0x9bdaf6, 0xfff0ad, 0xf3a9d6, 0xa9b6f4],
  ];
  const bytes = new Uint8Array(256 * 4 * 4);
  for (let row = 0; row < 4; row++)
    for (let x = 0; x < 256; x++) {
      const t = (x / 255) * 4,
        k = Math.min(3, Math.floor(t)),
        f = t - k;
      const a = palettes[row][k],
        b = palettes[row][k + 1],
        i = (row * 256 + x) * 4;
      for (let c = 0; c < 3; c++) {
        const shift = 16 - c * 8;
        bytes[i + c] = Math.round(
          ((a >> shift) & 255) * (1 - f) + ((b >> shift) & 255) * f,
        );
      }
      bytes[i + 3] = 255;
    }
  const ramp = new THREE.DataTexture(bytes, 256, 4, THREE.RGBAFormat);
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.minFilter = THREE.LinearFilter;
  ramp.magFilter = THREE.LinearFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}
export class ConfettiRenderer {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10);
  private geometry = starGeometry();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.InstancedMesh;
  private style = new THREE.InstancedBufferAttribute(
    new Float32Array(240 * 4),
    4,
  );
  private flip = new THREE.InstancedBufferAttribute(new Float32Array(240), 1);
  private ramp = prismRamp();
  private object = new THREE.Object3D();
  constructor(private shared?: THREE.WebGLRenderer) {
    this.renderer=shared ?? new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.style.setUsage(THREE.DynamicDrawUsage);
    this.flip.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceStyle', this.style);
    this.geometry.setAttribute('instanceFlip', this.flip);
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      forceSinglePass: true,
      toneMapped: false,
      uniforms: { ramp: { value: this.ramp } },
      vertexShader: `attribute vec4 instanceStyle; attribute float instanceFlip;
        varying vec2 vUv; varying vec4 vStyle; varying float vLight;
        void main(){
          vUv=uv;vStyle=instanceStyle;
          vLight=.86+.14*abs(cos(instanceFlip));
          vec3 p=position;

          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform sampler2D ramp; varying vec2 vUv;
        varying vec4 vStyle; varying float vLight;
        void main(){
          float t=clamp(mix(vUv.x,1.-vUv.y,vStyle.z),0.,1.);
          vec3 color=texture2D(ramp,vec2((t*255.+.5)/256.,(vStyle.y+.5)/4.)).rgb;
          float shine=1.-smoothstep(.015,.16,abs(t-(.3+.35*vLight)));
          color=mix(color*vLight,vec3(1.),shine*.12);
          gl_FragColor=vec4(color,vStyle.x);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 240);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
    this.camera.position.z = 5;
    this.renderer.setClearColor(0, 0);
  }
  draw(c: Confetti) {
    const dpr = c.low ? 1 : Math.min(devicePixelRatio, 1.5);
    if (this.renderer.getPixelRatio() !== dpr) this.renderer.setPixelRatio(dpr);
    if (
      this.renderer.domElement.width !== Math.floor(c.width * dpr) ||
      this.renderer.domElement.height !== Math.floor(c.height * dpr)
    )
      this.renderer.setSize(c.width, c.height);
    this.camera.left = 0;
    this.camera.right = c.width;
    this.camera.top = 0;
    this.camera.bottom = c.height;
    this.camera.updateProjectionMatrix();
    // Contact layer first, foreground last; depth is an authored visual layer.
    let n = 0;
    for (const front of [false, true])
      for (const p of c.particles)
        if (p.state && p.front === front) {
          this.object.position.set(p.x, p.y, front ? 1 : 0);
          this.object.rotation.set(0, 0, p.angle);
          const face = Math.cos(p.flip);
          // Signed projection shows the back face after each half-turn, rather
          // than repeatedly squashing the same front-facing star.
          const projected =
            Math.max(0.12, Math.abs(face)) *
            ((p.state === 1 ? face < 0 : p.backFace) ? -1 : 1);
          this.object.scale.set(p.w, p.h * projected, 1);
          this.object.updateMatrix();
          const ac = Math.cos(p.tiltAxis ?? 0),
            as = Math.sin(p.tiltAxis ?? 0),
            c = Math.cos(p.angle),
            s = Math.sin(p.angle);
          const xx = ac * ac + projected * as * as,
            xy = (1 - projected) * ac * as,
            yy = as * as + projected * ac * ac;
          const m = this.object.matrix.elements;
          m[0] = (c * xx - s * xy) * p.w;
          m[1] = (s * xx + c * xy) * p.w;
          m[4] = (c * xy - s * yy) * p.h;
          m[5] = (s * xy + c * yy) * p.h;
          this.mesh.setMatrixAt(n, this.object.matrix);
          this.style.setXYZW(n, p.alpha, p.color % 4, (p.id % 7) / 6, 0);
          this.flip.setX(n, p.flip);
          n++;
        }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.style.needsUpdate = true;
    this.flip.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
  debug(ctx: CanvasRenderingContext2D, c: Confetti, now: number) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.font = '12px sans-serif';
    for (const s of c.surfaces.values()) {
      ctx.strokeStyle =
        s.id === 'frontHair'
          ? '#f89cfa'
          : s.id === 'hair'
            ? '#70ffcd'
            : '#ffcf61';
      ctx.globalAlpha = s.valid && now - s.timestamp < 250 ? 1 : 0.3;
      ctx.beginPath();
      for (const [x, y, ex, ey] of s.segments) {
        const a = world({ x, y }, s.frame),
          b = world({ x: ex, y: ey }, s.frame);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f89cfa';
    for (const hand of c.hands) {
      for (const chain of [
        [0, 5, 6, 7, 8],
        [0, 9, 10, 11, 12],
        [0, 13, 14, 15, 16],
        [0, 17, 18, 19, 20],
      ]) {
        ctx.beginPath();
        chain.forEach((i, j) => {
          const p = c.map(hand[i * 3], hand[i * 3 + 1]);
          if (j) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#fff';
    for (const p of c.particles)
      if (p.state) {
        ctx.fillText(`${p.id}${p.state === 2 ? '·' : ''}`, p.x + 5, p.y);
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(10, 65, Math.min(245, c.width - 20), 95);
    ctx.fillStyle = '#fff';
    ctx.fillText(
      `P50 ${c.p50.toFixed(1)} ms / P95 ${c.p95.toFixed(1)} ms · ${c.active} 颗 / 接触 ${c.contacts} / 轮次 ${c.rounds} · ${c.low ? '低档' : '标准'}`,
      16,
      84,
    );
    if (c.frontHairEnabled) {
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(10, 165, Math.min(380, c.width - 20), 26);
      ctx.fillStyle = '#f89cfa';
      ctx.fillText(
        '发区验证 · 粉色短线为稳定发区内落点 · 未通过真人验收',
        16,
        183,
      );
      ctx.fillStyle = '#fff';
    }
    const sd = c.shoulderDiagnostics;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(10, 195, Math.min(540, c.width - 20), 76);
    ctx.fillStyle = '#ffcf61';
    ctx.fillText(
      `肩部点数：${sd.leftRaw ?? 0}/${sd.rightRaw ?? 0} → 平滑 ${sd.leftFit ?? 0}/${sd.rightFit ?? 0}`,
      16,
      212,
    );
    ctx.fillText(
      `可承接上限：${c.surfaces.get('left')?.capacity ?? 0}/${c.surfaces.get('right')?.capacity ?? 0} · ${sd.status === 'fresh' ? '结果新鲜' : sd.status === 'hair stale' ? '等待头发更新' : '等待肩部识别'}`,
      16,
      228,
    );
    ctx.fillText(
      `本轮肩部：投向 ${c.shoulderLaunches.left}/${c.shoulderLaunches.right} · 已落 ${c.landed.left ?? 0}/${c.landed.right ?? 0} · 失效淡出 ${c.shoulderLosses}`,
      16,
      244,
    );
    ctx.fillText(
      `未生成原因：${sd.leftReason ?? '等待'} / ${sd.rightReason ?? '等待'}`,
      16,
      260,
    );
    ctx.fillStyle = '#fff';
    let y = 102;
    for (const [key, m] of Object.entries(c.metrics)) {
      ctx.fillText(
        `${key}: ${m.valid ? '有效' : '无有效区域'} · ${Math.round(now - m.timestamp)} ms 前 · 耗时 ${m.duration.toFixed(1)} ms`,
        16,
        y,
      );
      y += 15;
    }
    ctx.restore();
  }
  dispose() {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.ramp.dispose();
    if(!this.shared){this.renderer.dispose();this.renderer.forceContextLoss();}
  }
}
