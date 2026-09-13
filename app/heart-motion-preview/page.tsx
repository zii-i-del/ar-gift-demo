'use client';
import {useEffect,useRef,useState} from 'react';
import {Interaction} from '../../lib/interaction';
export default function HeartMotionPreview(){
 const left=useRef<HTMLDivElement>(null),right=useRef<HTMLDivElement>(null),paused=useRef(false);
 const [mode,setMode]=useState('擦碰'),[revision,setRevision]=useState(0),[status,setStatus]=useState('加载中…'),[playing,setPlaying]=useState(true);
 useEffect(()=>{
  let stopped=false,frame=0,cleanup=()=>{};
  import('../../lib/heart-renderer').then(async({HeartRenderer})=>{
   const renderers=[new HeartRenderer(),new HeartRenderer(true)];
   cleanup=()=>renderers.forEach(r=>{r.renderer.domElement.remove();r.dispose();});
   try{
    await Promise.all(renderers.map(r=>r.load()));if(stopped)return;
    [left,right].forEach((host,i)=>host.current?.appendChild(renderers[i].renderer.domElement as unknown as Node));
    const engines=[new Interaction(),new Interaction(true)];let elapsed=0,last=performance.now(),sequence=0;
    const reset=()=>{elapsed=0;for(const e of engines){e.reset();e.width=440;e.height=360;
     Object.assign(e.hearts[0],{active:true,x:mode==='收尾'?220:mode==='正碰'?245:205,y:mode==='收尾'?240:105,age:.9,size:100,owner:'preview',vx:0,vy:mode==='收尾'?-20:110,colorOrder:sequence%2,birthOrder:sequence,motionAngle:0,angularVelocity:0,contactAge:undefined,contactBody:undefined,contactReleased:true,motesReleased:false,appearanceAngle:0});
    }sequence++;};reset();setStatus('左侧现有版 · 右侧轻量候选；模型、配色、灯光一致。');
    const tick=(now:number)=>{const dt=Math.min(.04,(now-last)/1000);last=now;
     if(!paused.current){elapsed+=dt;if(elapsed>1.8)reset();for(const e of engines){e.acceptHead(mode==='收尾'?null:{x:245,y:170,rx:45,ry:60,angle:0,vx:0,vy:0,omega:0,timestamp:now,reset:false});e.step(dt,now);}}
     renderers.forEach((r,i)=>r.draw(engines[i].hearts,440,360,undefined,0,1.9,0x252934,engines[i].heartTails,engines[i].heartPetals));
     frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
   }catch(e){setStatus('预览加载失败：'+String(e));}
  });return()=>{stopped=true;cancelAnimationFrame(frame);cleanup();};
 },[mode,revision]);
 return <main style={{maxWidth:960,margin:'30px auto',padding:24}}><h1>爱心互动 · 轻量对比</h1><p>{status}</p>
 <div style={{display:'flex',gap:12,margin:'20px 0',flexWrap:'wrap'}}>{['擦碰','正碰','收尾'].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:'10px 20px',background:mode===m?'#edd7ff':'#eee',border:0,borderRadius:12}}>{m}</button>)}<button onClick={()=>{paused.current=!paused.current;setPlaying(!paused.current);}}>{playing?'暂停':'播放'}</button><button onClick={()=>setRevision(v=>v+1)}>重播</button></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16}}>{[left,right].map((ref,i)=><section key={i}><h2>{i?'轻量候选':'现有版本'}</h2><div style={{position:'relative',aspectRatio:'440 / 360',background:'#252934',borderRadius:20,overflow:'hidden'}}><div ref={ref} className="motion-canvas"/>{mode!=='收尾'&&<div style={{position:'absolute',left:'45.45%',top:'30.55%',width:'20.45%',height:'33.33%',border:'1px dashed #85909d',borderRadius:'50%',pointerEvents:'none'}}/>}</div></section>)}</div>
 <p>虚线为碰撞区域示意，不是新增识别。收尾每轮交替粉／黄，散片数量与方向随轮次变化。</p><p>仅对比页启用，主页仍保留原效果。</p><a href="/?scene=hearts">返回互动主页</a><style>{'.motion-canvas canvas{width:100%!important;height:auto!important;display:block}'}</style></main>;
}
