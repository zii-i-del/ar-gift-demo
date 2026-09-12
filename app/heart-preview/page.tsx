'use client';
import {useEffect,useRef,useState} from 'react';
import type {Heart} from '../../lib/interaction';
export default function HeartPreview(){
  const host=useRef<HTMLDivElement>(null),baselineHost=useRef<HTMLDivElement>(null),age=useRef(1),playing=useRef(false),angle=useRef(0),speed=useRef(1),background=useRef(0x252934);
  const [status,setStatus]=useState('正在加载 Blender 模型…');
  const [variant,setVariant]=useState<'v3'|'v5'|'orange-current'|'orange-v9'|'orange-v10'|'orange-v11'|'orange-v12'|'orange-v13'|'orange-v14'>('orange-v14');
  const [quality,setQuality]=useState(true);
  const [polished,setPolished]=useState(true);
  const [clay,setClay]=useState(false);
  const small=useRef(false);
  useEffect(()=>{
    let disposed=false,frame=0,cleanup=()=>{};
    import('../../lib/heart-renderer').then(async({HeartRenderer})=>{
      if(disposed)return;const r=new HeartRenderer(variant,false,polished),baseline=new HeartRenderer(variant,false,false);cleanup=()=>{r.dispose();baseline.dispose();r.renderer.domElement.remove();baseline.renderer.domElement.remove();};
      r.renderer.setPixelRatio(quality?Math.min(devicePixelRatio*1.5,3):Math.min(devicePixelRatio,1.5));
      baseline.renderer.setPixelRatio(quality?Math.min(devicePixelRatio*1.5,3):Math.min(devicePixelRatio,1.5));
      try{await Promise.all([r.load(),baseline.load()]);if(disposed)return;
        if(clay)for(const renderer of [r,baseline])for(const slot of renderer.slots)for(const m of [...slot.materials,...slot.peach]){m.map=null;m.color.setHex(0xbcbcbc);m.emissive.setHex(0);m.roughness=.32;m.clearcoat=.2;}
        baselineHost.current?.append(baseline.renderer.domElement);
        host.current?.append(r.renderer.domElement);setStatus(({v5:'当前粉色',v3:'上一版粉色','orange-current':'原橙色 · 已替换','orange-v9':'上一橙色候选','orange-v10':'第三张配色＋粉色材质参数','orange-v11':'浓橙体积版 · 已替换','orange-v12':'浅蜜桃体积版 · 已替换','orange-v13':'蜜桃橙融合版 · 上一版','orange-v14':'暖蜂蜜杏黄 · 已接入手势主页'})[variant]);
        let last=performance.now();
        const tick=(now:number)=>{const dt=Math.min((now-last)/1000,.08);last=now;if(playing.current)age.current=(age.current+dt*speed.current)%3.6;
          const w=host.current?.clientWidth||600,h=440;
          const heart:Heart={active:age.current<3,x:w/2,y:370-Math.min(age.current,.5)*32-Math.max(0,age.current-.5)*24,age:age.current,owner:'preview',size:small.current?100:Math.min(300,w*.68)};
          r.draw([heart],w,h,undefined,playing.current ? undefined : angle.current,3,background.current);
          baseline.draw([heart],w,h,undefined,playing.current ? undefined : angle.current,3,background.current);
          frame=requestAnimationFrame(tick);
        };frame=requestAnimationFrame(tick);
      }catch(e){setStatus('模型加载失败：'+String(e));}
    });
    return()=>{disposed=true;cancelAnimationFrame(frame);cleanup();};
  },[variant,quality,polished,clay]);
  return <main style={{maxWidth:800,margin:'40px auto',padding:24}}>
    <h1 style={{fontSize:28}}>爱心材质对比</h1><p>{status}</p><p>{polished?'新曲面材质 · 已接入主页试用':'替换前质感'}</p>
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
      <section><p>替换前版本</p><div ref={baselineHost} style={{width:'100%',height:440,overflow:'hidden',borderRadius:24}}/></section>
      <section><p>{polished?'已恢复上一版模型 · 原配色材质':'当前版（对照）'}</p><div ref={host} style={{width:'100%',height:440,overflow:'hidden',borderRadius:24}}/></section>
    </div>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}>
      <button className="secondary-button" onClick={()=>setClay(v=>!v)}>{clay?'恢复彩色材质':'灰模检查体积'}</button>
      <button className="primary-button" onClick={()=>{age.current=1;playing.current=false;setPolished(v=>!v);}}>{polished?'对比当前质感':'查看新质感'}</button>
      <button className="primary-button" onClick={()=>{age.current=0;speed.current=1;playing.current=true;}}>重播完整动画</button>
      <button className="secondary-button" onClick={()=>{age.current=0;speed.current=.25;playing.current=true;}}>四分之一慢放</button>
      <button className="secondary-button" onClick={()=>{age.current=(age.current+1/30)%3;playing.current=false;}}>前进一帧</button>
      <button className="secondary-button" onClick={()=>{age.current=1;playing.current=false;angle.current=0;}}>正面定格</button>
      <button className="secondary-button" onClick={()=>{age.current=1;playing.current=false;angle.current=1.05;}}>查看侧面厚度</button>
      <button className="secondary-button" onClick={()=>{background.current=background.current===0x252934?0xf2eeee:0x252934;}}>切换深浅背景</button>
      <button className="secondary-button" onClick={()=>{background.current=0xc99683;}}>肤色背景</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v14');}}>暖蜂蜜杏黄 · 当前使用</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v13');}}>蜜桃橙融合版</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v12');}}>浅蜜桃＋粉色体积布局</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v11');}}>上一浓橙体积版</button>
      <button className="secondary-button" onClick={()=>{age.current=1;playing.current=false;setQuality(q=>!q);}}>{quality?'高清预览 → 普通清晰度':'普通清晰度 → 高清预览'}</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v10');}}>第三张配色＋统一材质</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-v9');}}>上一橙色候选</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('orange-current');}}>原橙色</button>
      <button className="secondary-button" onClick={()=>{age.current=1;angle.current=0;playing.current=false;setVariant('v5');}}>当前粉色</button>
      <button className="secondary-button" onClick={()=>{small.current=!small.current;age.current=1;playing.current=false;}}>切换小尺寸</button>
      <button className="secondary-button" onClick={()=>{age.current=1;playing.current=false;setVariant(v=>v==='v5'?'v3':'v5');}}>对比{variant==='v5'?'上一版':'当前使用版'}</button>
      <a className="secondary-button" href="/?scene=hearts">开启摄像头试比心</a>
    </div><p style={{marginTop:20}}>左右同步角度、大小与动画。主页已恢复矮宽版替换前的模型，配色、材质和灯光不变。左侧 3,072 三角形，右侧 4,416 三角形；主体不透背景，手机性能仍需真机测试。</p>
  </main>;
}
